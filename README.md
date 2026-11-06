# ESTATE AI — Dự đoán giá nhà Việt Nam

Ứng dụng tham khảo giá nhà tại Việt Nam bằng mô hình XGBoost. Dự án gồm API FastAPI, giao diện React/Vite, giao diện Streamlit cũ, dữ liệu CSV và các mô hình đã huấn luyện.

> Kết quả chỉ mang tính tham khảo, không phải giá thẩm định hay cam kết giao dịch.

## Chức năng

- Đăng ký, đăng nhập và lưu lịch sử dự đoán theo tài khoản.
- Dự đoán giá bằng pipeline XGBoost; so sánh tối đa 4 kịch bản trong một phiên.
- Xem thống kê thị trường, lọc theo diện tích và khoảng giá.
- Tìm địa chỉ trong dữ liệu và lọc danh sách bất động sản.
- Quản trị người dùng, xem trạng thái mô hình và chất lượng dữ liệu; tải dataset CSV.

Dataset hiện tại không có tọa độ địa lý, ngày đăng hay trường quận/huyện riêng. Bản đồ OpenStreetMap vì vậy chỉ là bản đồ nền tham khảo; ứng dụng không tự suy đoán vị trí hoặc tạo marker. Chức năng quét tin đăng đã được gỡ.

## Yêu cầu

Trên Windows:

- Git for Windows.
- Python 3.12.
- Node.js 20 LTS trở lên và npm.
- Kết nối Internet để cài thư viện và tải bản đồ nền.

Các lệnh dưới đây chạy trong **PowerShell**. Nên dùng thư mục dự án không đồng bộ lên dịch vụ chia sẻ công khai.

## 1. Tải mã nguồn từ GitHub

Mở PowerShell tại thư mục muốn lưu dự án, sau đó chạy:

```powershell
git clone https://github.com/thelearningest/XGboost-house-price-predictor.git
Set-Location XGboost-house-price-predictor
```

Nếu muốn tải một nhánh cụ thể:

```powershell
git clone --branch <ten-nhanh> --single-branch https://github.com/thelearningest/XGboost-house-price-predictor.git
Set-Location XGboost-house-price-predictor
```

## 2. Cài đặt môi trường Python và backend

Tạo môi trường ảo và cài dependencies:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Tạo file cấu hình cục bộ:

```powershell
Copy-Item .env.example .env
notepad .env
```

Ứng dụng dùng SQLite tại `estate_ai.db` theo mặc định. Muốn tạo tài khoản quản trị, bỏ dấu `#` ở các dòng `ESTATE_ADMIN_NAME`, `ESTATE_ADMIN_EMAIL`, `ESTATE_ADMIN_PASSWORD` trong `.env` và đặt email/mật khẩu riêng, đủ mạnh. Tài khoản được khởi tạo khi API chạy nếu cả email và mật khẩu đã được cấu hình. Không chia sẻ hoặc commit `.env`.

## 3. Cài đặt giao diện web

Mở **PowerShell thứ hai** tại thư mục gốc của dự án:

```powershell
Set-Location frontend
npm ci
```

`npm ci` cài đúng các phiên bản đã khóa trong `package-lock.json`.

## 4. Chạy ứng dụng

### Cửa sổ PowerShell thứ nhất — API

Tại thư mục gốc:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8088
```

API và tài liệu tương tác:

- API: <http://127.0.0.1:8088>
- Swagger UI: <http://127.0.0.1:8088/docs>
- Trạng thái dịch vụ: <http://127.0.0.1:8088/api/health>

### Cửa sổ PowerShell thứ hai — giao diện React

Tại thư mục `frontend`:

```powershell
npm run dev
```

Mở <http://127.0.0.1:5173>. Giữ cả hai cửa sổ terminal chạy trong khi sử dụng ứng dụng; nhấn `Ctrl+C` để dừng từng dịch vụ.

Nếu API chạy ở địa chỉ khác, tạo `frontend\.env.local` và đặt URL, ví dụ:

```dotenv
VITE_API_URL=http://127.0.0.1:8088
```

Đồng thời cập nhật `CORS_ORIGINS` trong `.env` cho đúng địa chỉ giao diện. Không đưa file `.env.local` vào Git.

## Giao diện Streamlit cũ (tùy chọn)

Giao diện Streamlit gọi API tại `http://127.0.0.1:8088/predict`, do đó cần khởi động API trước. Từ PowerShell khác tại thư mục gốc:

```powershell
.\.venv\Scripts\streamlit.exe run app/app.py
```

Mở <http://localhost:8501>. Nếu API ở địa chỉ khác, đặt biến `API_URL` trước khi chạy, ví dụ:

```powershell
$env:API_URL = "http://127.0.0.1:8088/predict"
.\.venv\Scripts\streamlit.exe run app/app.py
```

## Kiểm tra dự án

Chạy kiểm thử backend tại thư mục gốc:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

Kiểm tra kiểu TypeScript và build giao diện:

```powershell
Set-Location frontend
npm run build
```

### GitHub Codespaces / VS Code Dev Containers

Mở repository bằng Dev Container. Cấu hình trong `.devcontainer/devcontainer.json` cài Python/Node dependencies, khởi động API và giao diện web, rồi forward cổng `5173` và `8088`. Trong Codespaces, cổng giao diện được mở để xem trước ứng dụng.

## Cấu trúc thư mục

```text
app/          API FastAPI, xác thực, cơ sở dữ liệu và giao diện Streamlit cũ
frontend/     Giao diện React, TypeScript và Vite
Data/Raw/     Dataset CSV dùng để phân tích và huấn luyện
models/       Pipeline XGBoost và bộ tiền xử lý đã lưu
src/          Mã xử lý dữ liệu và huấn luyện mô hình
tests/        Kiểm thử API và phân quyền
notebooks/    Notebook khám phá dữ liệu
```

## API chính

| Phương thức | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/api/health` | Trạng thái API, mô hình và dataset |
| `POST` | `/api/auth/register` | Tạo tài khoản |
| `POST` | `/api/auth/login` | Đăng nhập |
| `GET` | `/api/auth/me` | Thông tin tài khoản hiện tại |
| `POST` | `/api/predict` | Dự đoán và lưu lịch sử; cần đăng nhập |
| `POST` | `/predict` | Endpoint tương thích cho giao diện Streamlit cũ |
| `GET` | `/api/history` | Lịch sử dự đoán cá nhân; cần đăng nhập |
| `GET` | `/api/stats/dashboard` | Số liệu tổng quan |
| `GET` | `/api/stats/market` | Phân tích thị trường, hỗ trợ lọc diện tích/giá |
| `GET` | `/api/map/properties` | Tìm và lọc địa chỉ, diện tích/giá |
| `GET` | `/api/admin/summary` | Thống kê quản trị; chỉ quản trị viên |
| `GET` | `/api/admin/dataset.csv` | Tải dataset; chỉ quản trị viên |

Giá dự đoán trả về theo đơn vị tỷ VNĐ; API `/api/predict` cũng trả giá trị VNĐ tương ứng.

## Huấn luyện lại mô hình (tùy chọn)

Từ thư mục gốc, chạy:

```powershell
.\.venv\Scripts\python.exe src\train_model.py
```

Lệnh này đọc `Data\Raw\vietnam_housing_dataset.csv` và ghi đè artifact trong `models\`. Chỉ chạy khi chủ động muốn huấn luyện lại; hãy sao lưu artifact hiện tại và kiểm tra kết quả đánh giá trước khi dùng mô hình mới.

## Khắc phục sự cố

- **Không tìm thấy Python 3.12:** cài Python 3.12 và kiểm tra bằng `py -3.12 --version`.
- **Không kết nối được API:** xác nhận terminal backend vẫn chạy tại cổng `8088`, rồi mở `/api/health`.
- **Lỗi CORS:** kiểm tra `CORS_ORIGINS` trong `.env`, dùng đúng địa chỉ giao diện và khởi động lại API.
- **Không có tài khoản quản trị:** kiểm tra hai biến email/mật khẩu trong `.env`; dừng và chạy lại API sau khi cấu hình.
- **Cổng đã được sử dụng:** dừng tiến trình đang dùng cổng hoặc cấu hình lại cổng API/giao diện và các URL tương ứng.

Chạy `--reload` chỉ phù hợp cho phát triển cục bộ. Khi triển khai công khai, cần cấu hình HTTPS, CORS theo đúng domain, thông tin quản trị mạnh và cơ sở dữ liệu phù hợp môi trường triển khai.
