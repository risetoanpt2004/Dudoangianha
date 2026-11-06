import os
from pathlib import Path

import pandas as pd
import requests
import streamlit as st


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = PROJECT_ROOT / "Data" / "Raw" / "vietnam_housing_dataset.csv"
API_URL = os.getenv("API_URL", "http://127.0.0.1:8088/predict")

st.set_page_config(
    page_title="Ước tính giá nhà | Nhà Việt",
    page_icon="🏡",
    layout="wide",
    initial_sidebar_state="collapsed",
)

st.markdown(
    """
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap');

    :root {
        --ink: #172b4d;
        --muted: #718198;
        --blue: #2878e5;
        --blue-dark: #1558bd;
        --line: #e8eef6;
        --canvas: #f5f8fc;
    }

    html, body, [class*="css"], [data-testid="stAppViewContainer"] {
        font-family: 'Be Vietnam Pro', sans-serif;
        color: var(--ink);
    }
    [data-testid="stAppViewContainer"] {
        background:
            radial-gradient(ellipse at 87% 2%, rgba(196, 224, 255, .42), transparent 29rem),
            var(--canvas);
    }
    [data-testid="stHeader"] { background: transparent; }
    .block-container { max-width: 1240px; padding-top: 2rem; padding-bottom: 3rem; }
    h1, h2, h3 { color: var(--ink); letter-spacing: -.035em; }
    .eyebrow {
        color: var(--blue); font-size: .76rem; font-weight: 800;
        letter-spacing: .13em; text-transform: uppercase; margin: 0 0 .55rem .15rem;
    }
    .hero-panel {
        display: flex; align-items: center; justify-content: space-between; gap: 2rem;
        padding: clamp(1.25rem, 3vw, 2rem);
        background: rgba(255,255,255,.92); border: 1px solid var(--line);
        border-radius: 22px; box-shadow: 0 12px 35px rgba(27, 57, 91, .055);
    }
    .hero-copy { min-width: 0; }
    .page-title {
        color: var(--ink); font-size: clamp(2.15rem, 4vw, 3rem);
        font-weight: 800; line-height: 1.12; letter-spacing: -.045em;
    }
    .page-subtitle { color: var(--muted); font-size: .96rem; margin-top: .55rem; }
    .status-pill {
        display: inline-flex; align-items: center; gap: .45rem;
        border: 1px solid #d5e8dc; background: #f0faf4; color: #26804b;
        border-radius: 999px; padding: .48rem .8rem; font-size: .78rem; font-weight: 700;
        white-space: nowrap;
    }
    .status-dot { width: .48rem; height: .48rem; background: #37ad68; border-radius: 50%; }
    [data-testid="stVerticalBlockBorderWrapper"] {
        background: rgba(255,255,255,.92);
        border: 1px solid var(--line);
        border-radius: 20px;
        box-shadow: 0 12px 35px rgba(27, 57, 91, .055);
    }
    .section-label {
        color: var(--muted); font-size: .75rem; font-weight: 800;
        letter-spacing: .1em; text-transform: uppercase;
    }
    .price-label { color: var(--muted); font-size: .9rem; font-weight: 600; }
    .price-value {
        color: var(--blue-dark); font-size: clamp(2.35rem, 5vw, 4rem);
        line-height: 1.12; font-weight: 800; letter-spacing: -.055em;
        margin: .45rem 0 .25rem;
    }
    .price-note { color: var(--muted); font-size: .88rem; }
    .price-icon {
        display: flex; width: 3.2rem; height: 3.2rem; align-items: center;
        justify-content: center; border-radius: 16px; background: #edf5ff;
        font-size: 1.55rem;
    }
    .tiny-note { color: var(--muted); font-size: .78rem; }
    div[data-testid="stFormSubmitButton"] button {
        height: 3.1rem; width: 100%; border: 0; border-radius: 12px;
        background: linear-gradient(110deg, #2878e5, #1558bd);
        color: white; font-weight: 700;
        box-shadow: 0 8px 18px rgba(40, 120, 229, .2);
    }
    div[data-testid="stFormSubmitButton"] button:hover {
        border: 0; background: linear-gradient(110deg, #1d69d1, #104ca7);
        color: white; transform: translateY(-1px);
    }
    [data-testid="stMetric"] {
        padding: .9rem 1rem; border: 1px solid var(--line); border-radius: 14px;
        background: #fbfdff;
    }
    [data-testid="stMetricLabel"] { color: var(--muted); }
    [data-testid="stMetricValue"] { color: var(--ink); font-weight: 800; }
    [data-testid="stDataFrame"] { border-radius: 12px; }
    div[data-testid="stNumberInput"] input,
    div[data-testid="stSelectbox"] [role="combobox"] {
        border-radius: 10px;
    }
    div[data-testid="stNumberInput"] input:focus,
    div[data-testid="stSelectbox"] [role="combobox"]:focus {
        border-color: var(--blue);
        box-shadow: 0 0 0 .15rem rgba(40, 120, 229, .14);
    }
    .price-histogram { display: grid; gap: .65rem; margin: .7rem 0 1rem; }
    .price-bin {
        display: grid; grid-template-columns: 105px minmax(40px, 1fr) 54px;
        align-items: center; gap: .7rem;
    }
    .price-bin-label, .price-bin-count { color: var(--muted); font-size: .73rem; }
    .price-bin-count { text-align: right; font-weight: 700; }
    .price-bin-track { height: .58rem; background: #edf2f8; border-radius: 99px; overflow: hidden; }
    .price-bin-fill { height: 100%; background: linear-gradient(90deg, #70b6ff, #2878e5); border-radius: 99px; }
    hr { border-color: var(--line); }
    @media (max-width: 760px) {
        .block-container { padding: 1.25rem 1rem 2rem; }
        .hero-panel { align-items: flex-start; flex-direction: column; gap: 1rem; }
        .page-title { font-size: clamp(2rem, 8vw, 2.6rem); }
        .page-subtitle { font-size: .9rem; }
        .price-bin { grid-template-columns: 88px minmax(24px, 1fr) 48px; gap: .45rem; }
    }
    </style>
    """,
    unsafe_allow_html=True,
)


@st.cache_data
def load_dataset() -> pd.DataFrame:
    if not DATA_PATH.is_file():
        raise FileNotFoundError(f"Không tìm thấy dữ liệu tại {DATA_PATH}")
    return pd.read_csv(DATA_PATH)


try:
    housing = load_dataset()
except (OSError, pd.errors.ParserError) as error:
    st.error(f"Không thể đọc dữ liệu dự án: {error}")
    st.stop()

required_columns = {"Price", "Area", "Bedrooms", "Bathrooms"}
missing_columns = required_columns.difference(housing.columns)
if missing_columns:
    st.error(f"Dữ liệu thiếu các cột bắt buộc: {', '.join(sorted(missing_columns))}")
    st.stop()

prices = pd.to_numeric(housing["Price"], errors="coerce").dropna()
areas = pd.to_numeric(housing["Area"], errors="coerce").dropna()
if prices.empty or areas.empty:
    st.error("Dữ liệu không có giá hoặc diện tích hợp lệ để hiển thị.")
    st.stop()

st.markdown(
    """
    <div class="eyebrow">DỮ LIỆU NHÀ Ở VIỆT NAM</div>
    <header class="hero-panel">
        <div class="hero-copy">
            <div class="page-title">Ước tính giá nhà<br>thông minh</div>
            <div class="page-subtitle">Tham khảo giá trị căn nhà dựa trên diện tích, tiện ích và pháp lý.</div>
        </div>
        <div class="status-pill"><span class="status-dot"></span> Mô hình sẵn sàng</div>
    </header>
    """,
    unsafe_allow_html=True,
)

st.write("")
form_column, dashboard_column = st.columns([0.88, 1.75], gap="large")

with form_column:
    with st.container(border=True, key="property_form"):
        st.markdown("### 🏠  Thông tin căn nhà")
        st.caption("Nhập các thông số để nhận mức giá tham khảo.")
        with st.form("prediction_form"):
            area = st.number_input(
                "Diện tích sử dụng (m²)",
                min_value=3.1,
                max_value=595.0,
                value=float(min(max(areas.median(), 3.1), 595.0)),
                step=1.0,
                help="Khoảng dữ liệu ghi nhận: 3,1–595 m².",
            )
            floors = st.number_input("Số tầng", min_value=1, max_value=10, value=3, step=1)
            bedrooms = st.number_input("Phòng ngủ", min_value=1, max_value=9, value=3, step=1)
            bathrooms = st.number_input("Phòng tắm", min_value=1, max_value=9, value=3, step=1)
            frontage = st.number_input(
                "Mặt tiền (m)",
                min_value=0.0,
                max_value=100.0,
                value=4.5,
                step=0.5,
                help="Nhập 0 nếu không có thông tin mặt tiền.",
            )
            access_road = st.number_input(
                "Đường trước nhà (m)",
                min_value=0.0,
                max_value=100.0,
                value=6.0,
                step=0.5,
                help="Nhập 0 nếu không có thông tin đường vào.",
            )
            legal_status = st.selectbox(
                "Tình trạng pháp lý",
                ["Have certificate", "Sale contract"],
                format_func=lambda value: {
                    "Have certificate": "Đã có sổ / giấy chứng nhận",
                    "Sale contract": "Hợp đồng mua bán",
                }[value],
            )
            submitted = st.form_submit_button(
                "✨  Ước tính giá nhà",
                type="primary",
                use_container_width=True,
            )

    if submitted:
        payload = {
            "Area": area,
            "Floors": floors,
            "Bedrooms": bedrooms,
            "Bathrooms": bathrooms,
            "Frontage": frontage,
            "Access road": access_road,
            "Legal status": legal_status,
        }
        with st.spinner("Đang phân tích thông tin căn nhà..."):
            try:
                response = requests.post(API_URL, json=payload, timeout=20)
                response.raise_for_status()
                result = response.json()
                prediction = float(result["prediction"])
                if not pd.notna(prediction):
                    raise ValueError("Giá dự đoán không phải là số hợp lệ.")
                st.session_state["prediction"] = prediction
                st.session_state["prediction_inputs"] = payload
            except requests.exceptions.HTTPError:
                st.error(f"API trả về lỗi HTTP {response.status_code}.")
                st.code(response.text or "Không có chi tiết lỗi.")
            except requests.exceptions.Timeout:
                st.error("API phản hồi quá thời gian. Hãy kiểm tra máy chủ FastAPI.")
            except requests.exceptions.RequestException as error:
                st.error(f"Không thể kết nối API tại {API_URL}: {error}")
            except (KeyError, TypeError, ValueError) as error:
                st.error(f"API trả về kết quả không hợp lệ: {error}")

with dashboard_column:
    with st.container(border=True):
        prediction_value = st.session_state.get("prediction")
        result_left, result_right = st.columns([4, 1], vertical_alignment="center")
        with result_left:
            st.markdown('<div class="price-label">GIÁ DỰ ĐOÁN</div>', unsafe_allow_html=True)
            if prediction_value is None:
                st.markdown('<div class="price-value">— — —</div>', unsafe_allow_html=True)
                st.markdown(
                    '<div class="price-note">Nhập thông tin bên trái và chọn “Ước tính giá nhà”.</div>',
                    unsafe_allow_html=True,
                )
            else:
                st.markdown(
                    f'<div class="price-value">{prediction_value:,.2f} <span style="font-size:1.15rem;letter-spacing:0">tỷ đồng</span></div>',
                    unsafe_allow_html=True,
                )
                st.markdown(
                    '<div class="price-note">Kết quả tham khảo từ mô hình XGBoost.</div>',
                    unsafe_allow_html=True,
                )
        with result_right:
            st.markdown('<div class="price-icon">🏡</div>', unsafe_allow_html=True)

        st.write("")
        metric_columns = st.columns(3)
        metric_columns[0].metric("Tin đăng trong dữ liệu", f"{len(housing):,}")
        metric_columns[1].metric("Giá trung vị", f"{prices.median():.1f} tỷ")
        metric_columns[2].metric("Diện tích trung vị", f"{areas.median():.0f} m²")
        st.caption(
            "Thống kê được tính trực tiếp từ bộ dữ liệu dự án; giá dự đoán không phải cam kết giao dịch."
        )

    st.write("")
    with st.container(border=True):
        st.markdown("### 📊  Toàn cảnh dữ liệu")
        st.caption("Phân bố giá của các tin nhà trong bộ dữ liệu.")
        price_bins = pd.cut(prices, bins=10, include_lowest=True)
        price_counts = price_bins.value_counts(sort=False)
        max_count = int(price_counts.max())
        histogram_rows = []
        for interval, count in price_counts.items():
            if count:
                width = int(count / max_count * 100)
                histogram_rows.append(
                    '<div class="price-bin">'
                    f'<span class="price-bin-label">{interval.left:.1f}–{interval.right:.1f} tỷ</span>'
                    '<div class="price-bin-track">'
                    f'<div class="price-bin-fill" style="width:{width}%"></div>'
                    '</div>'
                    f'<span class="price-bin-count">{int(count):,}</span>'
                    '</div>'
                )
        st.markdown(
            '<div class="price-histogram">' + "".join(histogram_rows) + "</div>",
            unsafe_allow_html=True,
        )
        range_left, range_right = st.columns(2)
        range_left.metric("Mức giá thấp nhất", f"{prices.min():.1f} tỷ")
        range_right.metric("Mức giá cao nhất", f"{prices.max():.1f} tỷ")

st.write("")
st.markdown(
    '<div class="tiny-note">Nguồn: vietnam_housing_dataset.csv · Đơn vị giá được biểu thị bằng tỷ VND.</div>',
    unsafe_allow_html=True,
)
