import csv
import io
import os
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Any

import joblib
import numpy as np
import pandas as pd
from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from starlette.responses import StreamingResponse

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(PROJECT_ROOT / ".env")

from app.database import (
    AuthSession,
    PredictionRecord,
    User,
    get_db,
    initialize_database,
)
from app.security import create_access_token, hash_access_token, hash_password, verify_password


MODEL_DIR = PROJECT_ROOT / "models"
DATA_PATH = PROJECT_ROOT / "Data" / "Raw" / "vietnam_housing_dataset.csv"
PIPELINE_PATH = MODEL_DIR / "xgboost_pipeline.pkl"
ORIGINAL_MODEL_PATH = MODEL_DIR / "xgboost_original.pkl"
PREPROCESSOR_PATH = MODEL_DIR / "preprocessor.pkl"
TOKEN_LIFETIME = timedelta(hours=24)

model_pipeline: Any | None = None
model: Any | None = None
preprocessor: Any | None = None
model_load_error: str | None = None
try:
    if PIPELINE_PATH.is_file():
        model_pipeline = joblib.load(PIPELINE_PATH)
    elif ORIGINAL_MODEL_PATH.is_file() and PREPROCESSOR_PATH.is_file():
        model = joblib.load(ORIGINAL_MODEL_PATH)
        preprocessor = joblib.load(PREPROCESSOR_PATH)
    else:
        model_load_error = "Không tìm thấy đủ tệp mô hình XGBoost và bộ tiền xử lý."
except (OSError, EOFError, ValueError, ImportError) as error:
    model_load_error = f"Không thể tải mô hình XGBoost: {error}"

initialize_database()
security = HTTPBearer(auto_error=False)


class InputData(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    Area: float = Field(gt=0, le=100_000)
    Floors: int | None = Field(default=None, ge=1, le=100)
    Bedrooms: int | None = Field(default=None, ge=1, le=100)
    Bathrooms: int | None = Field(default=None, ge=1, le=100)
    Frontage: float | None = Field(default=None, ge=0, le=1_000)
    Access_road: float | None = Field(default=None, alias="Access road", ge=0, le=1_000)
    Legal_status: str | None = Field(default=None, alias="Legal status", max_length=100)

    @model_validator(mode="after")
    def normalize_empty_legal_status(self) -> "InputData":
        if self.Legal_status is not None and not self.Legal_status.strip():
            self.Legal_status = None
        return self


class PredictionRequest(InputData):
    address: str | None = Field(default=None, max_length=500)


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=1, max_length=128)


class UserUpdate(BaseModel):
    role: str | None = None
    is_active: bool | None = None


class AdminUserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=8, max_length=128)
    role: str = "user"


@lru_cache(maxsize=1)
def load_dataset() -> pd.DataFrame:
    if not DATA_PATH.is_file():
        raise FileNotFoundError(f"Không tìm thấy dữ liệu tại {DATA_PATH}")
    return pd.read_csv(DATA_PATH)


def filter_properties(
    data: pd.DataFrame,
    min_area: float | None,
    max_area: float | None,
    min_price: float | None,
    max_price: float | None,
) -> pd.DataFrame:
    if min_area is not None and max_area is not None and min_area > max_area:
        raise HTTPException(status_code=422, detail="Diện tích tối thiểu không được lớn hơn tối đa.")
    if min_price is not None and max_price is not None and min_price > max_price:
        raise HTTPException(status_code=422, detail="Giá tối thiểu không được lớn hơn tối đa.")
    area = pd.to_numeric(data["Area"], errors="coerce")
    price = pd.to_numeric(data["Price"], errors="coerce")
    matches = pd.Series(True, index=data.index)
    if min_area is not None:
        matches &= area >= min_area
    if max_area is not None:
        matches &= area <= max_area
    if min_price is not None:
        matches &= price >= min_price
    if max_price is not None:
        matches &= price <= max_price
    return data.loc[matches]


def engineer_features(data: InputData) -> pd.DataFrame:
    row = data.model_dump(by_alias=True)
    frame = pd.DataFrame([row])
    for column in ("Area", "Floors", "Bedrooms", "Bathrooms", "Frontage", "Access road"):
        frame[column] = pd.to_numeric(frame[column], errors="coerce")
    frame["log_Area"] = np.log1p(frame["Area"])
    frame["log_Frontage"] = np.log1p(frame["Frontage"])
    frame["log_access_road"] = np.log1p(frame["Access road"])
    frame["Frontage_missing"] = frame["Frontage"].isna().astype(int)
    frame["AccessRoad_missing"] = frame["Access road"].isna().astype(int)
    frame["bedrooms_per_bathroom"] = frame["Bedrooms"] / frame["Bathrooms"].replace(0, np.nan)
    return frame


def predict_price(data: InputData) -> float:
    if model_load_error is not None or (model_pipeline is None and (model is None or preprocessor is None)):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=model_load_error or "Mô hình XGBoost chưa sẵn sàng.",
        )

    frame = engineer_features(data)
    if model_pipeline is not None:
        expected_features = model_pipeline.feature_names_in_
        prediction = model_pipeline.predict(frame.loc[:, expected_features])
    else:
        assert preprocessor is not None and model is not None
        expected_features = preprocessor.feature_names_in_
        transformed = preprocessor.transform(frame.loc[:, expected_features])
        expected_count = getattr(model, "n_features_in_", transformed.shape[1])
        if transformed.shape[1] != expected_count:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Mô hình và bộ tiền xử lý không tương thích. Cần khôi phục đúng cặp tệp.",
            )
        prediction = model.predict(transformed)
    result = float(prediction[0])
    if not np.isfinite(result):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Mô hình không trả về một giá trị dự đoán hợp lệ.",
        )
    return result


def serialize_user(user: User) -> dict[str, Any]:
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat(),
    }


def create_session(db: Session, user: User) -> str:
    token, token_hash = create_access_token()
    db.add(
        AuthSession(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=datetime.utcnow() + TOKEN_LIFETIME,
        )
    )
    db.commit()
    return token


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Vui lòng đăng nhập để tiếp tục.")
    session = db.scalar(
        select(AuthSession).where(
            AuthSession.token_hash == hash_access_token(credentials.credentials),
            AuthSession.expires_at > datetime.utcnow(),
        )
    )
    if session is None or not session.user.is_active:
        raise HTTPException(status_code=401, detail="Phiên đăng nhập hết hạn hoặc không hợp lệ.")
    return session.user


def require_admin(user: Annotated[User, Depends(get_current_user)]) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Bạn không có quyền quản trị.")
    return user


@asynccontextmanager
async def lifespan(_: FastAPI):
    admin_email = os.getenv("ESTATE_ADMIN_EMAIL", "").strip().lower()
    admin_password = os.getenv("ESTATE_ADMIN_PASSWORD", "")
    admin_name = os.getenv("ESTATE_ADMIN_NAME", "Quản trị viên")
    if admin_email and admin_password:
        from app.database import SessionLocal

        with SessionLocal() as db:
            if db.scalar(select(User).where(User.email == admin_email)) is None:
                db.add(
                    User(
                        name=admin_name,
                        email=admin_email,
                        password_hash=hash_password(admin_password),
                        role="admin",
                    )
                )
                db.commit()
    yield


app = FastAPI(
    title="ESTATE AI — Dự đoán giá nhà Việt Nam",
    description="API dự đoán giá nhà bằng pipeline XGBoost đã huấn luyện.",
    version="1.0.0",
    lifespan=lifespan,
)

origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "ESTATE AI API", "docs": "/docs"}


@app.get("/api/health")
def health() -> dict[str, Any]:
    data_status = "ready" if DATA_PATH.is_file() else "unavailable"
    return {
        "status": "ok",
        "model_status": "ready" if model_load_error is None and (model_pipeline is not None or model is not None) else "unavailable",
        "model_message": model_load_error,
        "dataset_status": data_status,
    }


@app.post("/api/auth/register", status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Annotated[Session, Depends(get_db)]) -> dict[str, Any]:
    email = payload.email.strip().lower()
    if "@" not in email or "." not in email.rsplit("@", maxsplit=1)[-1]:
        raise HTTPException(status_code=422, detail="Địa chỉ email không hợp lệ.")
    user = User(name=payload.name.strip(), email=email, password_hash=hash_password(payload.password))
    db.add(user)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="Email này đã được đăng ký.") from error
    db.refresh(user)
    return {"access_token": create_session(db, user), "token_type": "bearer", "user": serialize_user(user)}


@app.post("/api/auth/login")
def login(payload: LoginRequest, db: Annotated[Session, Depends(get_db)]) -> dict[str, Any]:
    email = payload.email.strip().lower()
    user = db.scalar(select(User).where(User.email == email))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email hoặc mật khẩu không chính xác.")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Tài khoản đã bị vô hiệu hóa.")
    return {"access_token": create_session(db, user), "token_type": "bearer", "user": serialize_user(user)}


@app.get("/api/auth/me")
def current_user_profile(user: Annotated[User, Depends(get_current_user)]) -> dict[str, Any]:
    return serialize_user(user)


@app.post("/predict")
def predict_legacy(data: InputData) -> dict[str, float]:
    return {"prediction": predict_price(data)}


@app.post("/api/predict")
def predict(
    data: PredictionRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, Any]:
    price = predict_price(data)
    record = PredictionRecord(
        user_id=user.id,
        address=data.address.strip() if data.address and data.address.strip() else None,
        payload=data.model_dump(by_alias=True, exclude={"address"}),
        prediction_billion=price,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return {
        "id": record.id,
        "prediction_billion": price,
        "prediction_vnd": price * 1_000_000_000,
        "address": record.address,
        "inputs": record.payload,
        "created_at": record.created_at.isoformat(),
    }


def serialize_prediction(record: PredictionRecord) -> dict[str, Any]:
    return {
        "id": record.id,
        "code": f"EA-{record.created_at:%y%m%d}-{record.id:05d}",
        "address": record.address or "Chưa cung cấp địa chỉ",
        "area": record.payload["Area"],
        "prediction_billion": record.prediction_billion,
        "prediction_vnd": record.prediction_billion * 1_000_000_000,
        "created_at": record.created_at.isoformat(),
        "status": "Hoàn tất",
        "inputs": record.payload,
    }


@app.get("/api/history")
def prediction_history(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    search: str = Query(default="", max_length=200),
) -> dict[str, Any]:
    statement = select(PredictionRecord).where(PredictionRecord.user_id == user.id)
    if search.strip():
        statement = statement.where(PredictionRecord.address.ilike(f"%{search.strip()}%"))
    total = db.scalar(select(func.count()).select_from(statement.subquery())) or 0
    rows = db.scalars(
        statement.order_by(PredictionRecord.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return {
        "items": [serialize_prediction(row) for row in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@app.get("/api/history/{prediction_id}")
def prediction_detail(
    prediction_id: int,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, Any]:
    record = db.scalar(
        select(PredictionRecord).where(
            PredictionRecord.id == prediction_id, PredictionRecord.user_id == user.id
        )
    )
    if record is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy kết quả dự đoán.")
    return serialize_prediction(record)


@app.delete("/api/history/{prediction_id}")
def delete_prediction(
    prediction_id: int,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, bool]:
    record = db.scalar(
        select(PredictionRecord).where(
            PredictionRecord.id == prediction_id, PredictionRecord.user_id == user.id
        )
    )
    if record is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy kết quả dự đoán.")
    db.delete(record)
    db.commit()
    return {"deleted": True}


@app.get("/api/stats/dashboard")
def dashboard_stats(db: Annotated[Session, Depends(get_db)]) -> dict[str, Any]:
    data = load_dataset()
    prices = pd.to_numeric(data["Price"], errors="coerce").dropna()
    return {
        "property_count": int(len(data)),
        "prediction_count": db.scalar(select(func.count(PredictionRecord.id))) or 0,
        "user_count": db.scalar(select(func.count(User.id)).where(User.is_active.is_(True))) or 0,
        "average_price_billion": float(prices.mean()),
        "average_price_vnd": float(prices.mean() * 1_000_000_000),
        "median_area": float(pd.to_numeric(data["Area"], errors="coerce").median()),
        "model_status": "ready" if model_load_error is None and (model_pipeline is not None or model is not None) else "unavailable",
    }


@app.get("/api/stats/market")
def market_stats(
    min_area: float | None = Query(default=None, ge=0),
    max_area: float | None = Query(default=None, ge=0),
    min_price: float | None = Query(default=None, ge=0, description="Tỷ VNĐ"),
    max_price: float | None = Query(default=None, ge=0, description="Tỷ VNĐ"),
) -> dict[str, Any]:
    data = filter_properties(load_dataset(), min_area, max_area, min_price, max_price)
    area = pd.to_numeric(data["Area"], errors="coerce")
    price = pd.to_numeric(data["Price"], errors="coerce")
    floors = pd.to_numeric(data["Floors"], errors="coerce")
    area_bins = pd.cut(
        area,
        bins=[0, 30, 50, 80, 120, float("inf")],
        labels=["Dưới 30 m²", "30–50 m²", "50–80 m²", "80–120 m²", "Trên 120 m²"],
        include_lowest=True,
    )
    price_bins = pd.cut(price, bins=8, include_lowest=True) if price.notna().any() else pd.Series(dtype="object")
    area_prices = (
        pd.DataFrame({"nhóm": area_bins, "price": price})
        .groupby("nhóm", observed=False)["price"]
        .mean()
        .dropna()
    )
    floor_prices = (
        pd.DataFrame({"floors": floors, "price": price})
        .dropna()
        .groupby("floors")["price"]
        .mean()
        .sort_index()
    )
    price_counts = price_bins.value_counts(sort=False)
    floor_counts = floors.dropna().astype(int).value_counts().sort_index()
    return {
        "property_count": int(len(data)),
        "average_by_area": [
            {"name": str(name), "price_billion": float(value)}
            for name, value in area_prices.items()
        ],
        "average_by_floors": [
            {"name": f"{int(name)} tầng", "price_billion": float(value)}
            for name, value in floor_prices.items()
        ],
        "price_distribution": [
            {
                "name": f"{interval.left:.1f}–{interval.right:.1f} tỷ",
                "count": int(count),
            }
            for interval, count in price_counts.items()
            if count
        ],
        "floor_distribution": [
            {"name": f"{int(name)} tầng", "count": int(count)}
            for name, count in floor_counts.items()
        ],
        "limitations": {
            "location": "Bộ dữ liệu không có tọa độ hoặc trường quận/huyện riêng.",
            "property_type": "Bộ dữ liệu không có trường phân loại loại bất động sản.",
            "price_trend": "Bộ dữ liệu không có ngày đăng hoặc lịch sử giá.",
        },
    }


@app.get("/api/map/properties")
def map_properties(
    search: str = Query(default="", max_length=200),
    limit: int = Query(default=50, ge=1, le=200),
    min_area: float | None = Query(default=None, ge=0),
    max_area: float | None = Query(default=None, ge=0),
    min_price: float | None = Query(default=None, ge=0, description="Tỷ VNĐ"),
    max_price: float | None = Query(default=None, ge=0, description="Tỷ VNĐ"),
) -> dict[str, Any]:
    data = filter_properties(load_dataset(), min_area, max_area, min_price, max_price)
    properties = data.loc[:, ["Address", "Area", "Price"]].dropna(subset=["Address"]).copy()
    if search.strip():
        properties = properties[
            properties["Address"].astype(str).str.contains(
                search.strip(), case=False, na=False, regex=False
            )
        ]
    items = [
            {
                "address": str(row["Address"]),
                "area": None if pd.isna(row["Area"]) else float(row["Area"]),
                "price_billion": None if pd.isna(row["Price"]) else float(row["Price"]),
                "latitude": None,
                "longitude": None,
                "location_precision": "Chưa có tọa độ trong bộ dữ liệu",
            }
            for _, row in properties.head(limit).iterrows()
        ]
    return {
        "items": items[:limit],
        "coordinates_available": False,
        "notice": "Bộ dữ liệu chỉ có địa chỉ dạng văn bản, không có tọa độ để đặt marker.",
        "total": int(len(properties)),
    }


@app.get("/api/admin/summary")
def admin_summary(
    _: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, Any]:
    data = load_dataset()
    return {
        "user_count": db.scalar(select(func.count(User.id))) or 0,
        "prediction_count": db.scalar(select(func.count(PredictionRecord.id))) or 0,
        "property_count": int(len(data)),
        "model": {
            "name": "XGBoost Regressor",
            "status": "ready" if model_load_error is None and (model_pipeline is not None or model is not None) else "unavailable",
            "artifact": str(PIPELINE_PATH.name if model_pipeline is not None else ORIGINAL_MODEL_PATH.name),
            "features": list(getattr(model_pipeline or preprocessor, "feature_names_in_", [])),
            "metrics": None,
            "metrics_note": "Chỉ số kiểm thử không được lưu kèm artifact mô hình.",
        },
        "dataset": {
            "columns": list(data.columns),
            "rows": int(len(data)),
            "missing_values": {key: int(value) for key, value in data.isna().sum().items()},
        },
    }

@app.get("/api/admin/dataset.csv")
def export_dataset(_: Annotated[User, Depends(require_admin)]) -> StreamingResponse:
    data = load_dataset()
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(data.columns)
    for row in data.itertuples(index=False, name=None):
        values = []
        for value in row:
            if pd.isna(value):
                values.append("")
            elif isinstance(value, str) and value.lstrip().startswith(("=", "+", "-", "@")):
                values.append(f"'{value}")
            else:
                values.append(value)
        writer.writerow(values)
    content = "\ufeff" + output.getvalue()
    return StreamingResponse(
        iter([content]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="vietnam_housing_dataset.csv"'},
    )


@app.get("/api/admin/users")
def admin_users(
    _: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> dict[str, Any]:
    total = db.scalar(select(func.count(User.id))) or 0
    users = db.scalars(
        select(User).order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    ).all()
    return {"items": [serialize_user(user) for user in users], "total": total, "page": page, "page_size": page_size}


@app.post("/api/admin/users", status_code=status.HTTP_201_CREATED)
def create_admin_user(
    payload: AdminUserCreate,
    _: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, Any]:
    email = payload.email.strip().lower()
    if "@" not in email or "." not in email.rsplit("@", maxsplit=1)[-1]:
        raise HTTPException(status_code=422, detail="Địa chỉ email không hợp lệ.")
    if payload.role not in {"user", "admin"}:
        raise HTTPException(status_code=422, detail="Vai trò chỉ có thể là user hoặc admin.")
    user = User(
        name=payload.name.strip(),
        email=email,
        password_hash=hash_password(payload.password),
        role=payload.role,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="Email này đã được đăng ký.") from error
    db.refresh(user)
    return serialize_user(user)


@app.patch("/api/admin/users/{user_id}")
def update_user(
    user_id: int,
    payload: UserUpdate,
    admin: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, Any]:
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản.")
    if payload.role is not None:
        if payload.role not in {"user", "admin"}:
            raise HTTPException(status_code=422, detail="Vai trò chỉ có thể là user hoặc admin.")
        if target.id == admin.id and payload.role != "admin":
            raise HTTPException(status_code=400, detail="Không thể tự hạ quyền quản trị của mình.")
        target.role = payload.role
    if payload.is_active is not None:
        if target.id == admin.id and not payload.is_active:
            raise HTTPException(status_code=400, detail="Không thể tự vô hiệu hóa tài khoản.")
        target.is_active = payload.is_active
    db.commit()
    db.refresh(target)
    return serialize_user(target)


@app.delete("/api/admin/users/{user_id}")
def delete_user(
    user_id: int,
    admin: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, bool]:
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản.")
    if target.id == admin.id:
        raise HTTPException(status_code=400, detail="Không thể xóa tài khoản đang đăng nhập.")
    db.delete(target)
    db.commit()
    return {"deleted": True}
