import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  Building2,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  Download,
  FileText,
  House,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  MapPin,
  Menu,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { MapContainer, TileLayer } from "react-leaflet";
import { api } from "./api";
import { useAuth } from "./auth";
import type {
  AdminSummary,
  DashboardStats,
  HistoryItem,
  MapProperties,
  MarketStats,
  PredictionInput,
  PredictionResult,
  User,
} from "./types";

const money = (value: number) =>
  `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value)} VNĐ`;
const billions = (value: number) =>
  `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(value)} tỷ`;
const dateTime = (value: string) =>
  new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const shortNumber = (value: number) => new Intl.NumberFormat("vi-VN").format(value);
function App() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (location.pathname.startsWith("/auth")) return <AuthPage />;
  if (loading) return <LoadingPage />;
  if (!user) return <Navigate to="/auth/login" replace />;
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-column">
        <Topbar />
        <main className="page-main">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/predict" element={<PredictionPage />} />
            <Route path="/market" element={<MarketPage />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/admin" element={user.role === "admin" ? <AdminPage /> : <Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <footer className="app-footer">
          <span>© 2026 ESTATE AI</span>
          <span>Giá trị tham khảo từ dữ liệu và mô hình XGBoost · Không thay thế tư vấn thẩm định</span>
        </footer>
      </div>
    </div>
  );
}

function LoadingPage() {
  return <div className="loading-screen"><LoaderCircle className="spin" size={26} /> Đang kiểm tra phiên đăng nhập…</div>;
}

function AuthPage() {
  const { user, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [registering, setRegistering] = useState(location.pathname.includes("register"));
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => setRegistering(window.location.pathname.endsWith("register")), []);
  if (user) return <Navigate to="/" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (registering && password !== confirmation) {
      setError("Mật khẩu xác nhận chưa khớp.");
      return;
    }
    setBusy(true);
    try {
      if (registering) await signUp(name, email, password);
      else await signIn(email, password);
      navigate("/");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể hoàn tất yêu cầu.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-visual">
        <Link className="brand auth-brand" to="/auth/login"><BrandMark /><span>ESTATE<span className="brand-accent">AI</span></span></Link>
        <div className="auth-visual-content">
          <div className="eyebrow light-eyebrow"><Sparkles size={14} /> DỮ LIỆU & TRÍ TUỆ NHÂN TẠO</div>
          <h1>Hiểu giá trị.<br /><span>Chọn đúng tương lai.</span></h1>
          <p>Tham khảo giá nhà Việt Nam dựa trên bộ dữ liệu thực và pipeline XGBoost đã huấn luyện.</p>
          <div className="auth-stat"><div className="auth-stat-icon"><Building2 size={20} /></div><div><strong>30.229</strong><small>mẫu dữ liệu nhà ở</small></div><div className="auth-stat-rule" /><div><strong>10</strong><small>đặc trưng mô hình</small></div></div>
        </div>
        <div className="auth-visual-foot">ESTATE AI · Vietnamese House Price Prediction</div>
      </div>
      <div className="auth-panel">
        <div className="auth-mobile-brand"><BrandMark /><b>ESTATE<span className="brand-accent">AI</span></b></div>
        <div className="auth-form-wrap">
          <div className="auth-kicker">{registering ? "BẮT ĐẦU MIỄN PHÍ" : "CHÀO MỪNG TRỞ LẠI"}</div>
          <h2>{registering ? "Tạo tài khoản mới" : "Đăng nhập tài khoản"}</h2>
          <p className="muted">{registering ? "Lưu kết quả và theo dõi lịch sử dự đoán của bạn." : "Đăng nhập để tiếp tục tới không gian làm việc."}</p>
          <form onSubmit={submit} className="auth-form">
            {registering && <Field label="Họ và tên"><input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Nguyễn Minh Anh" required minLength={2} /></Field>}
            <Field label="Email"><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ban@email.com" required /></Field>
            <Field label="Mật khẩu"><input type="password" autoComplete={registering ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Tối thiểu 8 ký tự" required minLength={registering ? 8 : 1} /></Field>
            {registering && <Field label="Xác nhận mật khẩu"><input type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Nhập lại mật khẩu" required /></Field>}
            {!registering && <label className="remember-row"><input type="checkbox" defaultChecked /> <span>Ghi nhớ đăng nhập trên thiết bị này</span><button type="button" className="text-button" onClick={() => setError("Vui lòng liên hệ quản trị viên để đặt lại mật khẩu.")}>Quên mật khẩu?</button></label>}
            {error && <div className="inline-error">{error}</div>}
            <button className="button button-primary auth-submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={18} /> : null}{registering ? "Tạo tài khoản" : "Đăng nhập"} <ArrowRight size={17} /></button>
          </form>
          <div className="auth-switch">{registering ? "Đã có tài khoản?" : "Bạn chưa có tài khoản?"}{" "}<button className="text-button" onClick={() => { setError(""); setRegistering(!registering); }}>{registering ? "Đăng nhập" : "Đăng ký ngay"}</button></div>
          <div className="auth-secure"><ShieldCheck size={15} /> Thông tin tài khoản được bảo vệ an toàn</div>
        </div>
      </div>
    </div>
  );
}

function BrandMark() {
  return <span className="brand-mark"><House size={18} strokeWidth={2.2} /><i /></span>;
}

const navItems = [
  { to: "/", label: "Tổng quan", icon: LayoutDashboard, end: true },
  { to: "/predict", label: "Dự đoán giá", icon: Sparkles },
  { to: "/market", label: "Phân tích thị trường", icon: BarChart3 },
  { to: "/map", label: "Bản đồ bất động sản", icon: MapPin },
  { to: "/history", label: "Lịch sử dự đoán", icon: Clock3 },
];

function Sidebar() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <>
      {open && <button className="mobile-backdrop" onClick={() => setOpen(false)} aria-label="Đóng menu" />}
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <Link className="brand" to="/" onClick={() => setOpen(false)}><BrandMark /><span>ESTATE<span className="brand-accent">AI</span></span></Link>
        <div className="workspace-label">KHÔNG GIAN LÀM VIỆC</div>
        <nav className="side-nav">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)} className={({ isActive }) => `nav-link ${isActive ? "nav-link-active" : ""}`}>
              <Icon size={18} /><span>{label}</span>{to === "/predict" && <span className="nav-new"><Plus size={12} /></span>}
            </NavLink>
          ))}
          {user?.role === "admin" && <NavLink to="/admin" onClick={() => setOpen(false)} className={({ isActive }) => `nav-link ${isActive ? "nav-link-active" : ""}`}><ShieldCheck size={18} /><span>Quản trị hệ thống</span></NavLink>}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card"><div className="help-icon"><CircleHelp size={17} /></div><b>Cần hỗ trợ?</b><p>Khám phá cách sử dụng các công cụ.</p><a href="mailto:support@estateai.vn">Liên hệ hỗ trợ <ArrowRight size={13} /></a></div>
          <button className="user-card" onClick={signOut}><span className="avatar">{(user?.name ?? "E").slice(0, 1).toUpperCase()}</span><span className="user-card-text"><b>{user?.name}</b><small>{user?.role === "admin" ? "Quản trị viên" : user?.email}</small></span><LogOut size={16} className="logout-icon" /></button>
        </div>
      </aside>
      <button className="mobile-menu-button" onClick={() => setOpen(true)} aria-label="Mở menu"><Menu size={21} /></button>
    </>
  );
}

function Topbar() {
  const { user } = useAuth();
  const location = useLocation();
  const current = [...navItems, { to: "/admin", label: "Quản trị hệ thống", icon: ShieldCheck }].find((item) => item.to === location.pathname);
  return (
    <header className="topbar">
      <div className="breadcrumbs"><span>ESTATE AI</span><ChevronRight size={14} /><b>{current?.label ?? "Tổng quan"}</b></div>
      <div className="topbar-right"><span className="topbar-date">{new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}</span><button className="icon-button notification-button" aria-label="Thông báo"><Bell size={18} /><i /></button><div className="topbar-avatar">{(user?.name ?? "E").slice(0, 1).toUpperCase()}</div></div>
    </header>
  );
}

function PageHeading({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle: string; action?: ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div>{action && <div className="heading-action">{action}</div>}</div>;
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>;
}

function CardTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return <div className="card-title-row"><div><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>{action}</div>;
}

function StatCard({ title, value, note, icon: Icon, tone, change }: { title: string; value: string; note: string; icon: typeof Building2; tone: string; change?: "up" | "down" }) {
  return <Card className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={19} /></div><div className="stat-card-title">{title}</div><div className="stat-value">{value}</div><div className="stat-note">{change && <span className={`stat-change ${change}`}><ArrowUpRight size={13} /></span>}{note}</div></Card>;
}

function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [market, setMarket] = useState<MarketStats | null>(null);
  const [recent, setRecent] = useState<HistoryItem[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    Promise.all([api.dashboard(), api.market(), api.history(1, "", 5)])
      .then(([dashboard, marketData, history]) => {
        setStats(dashboard);
        setMarket(marketData);
        setRecent(history.items);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Không tải được dữ liệu tổng quan."))
      .finally(() => setBusy(false));
  }, []);

  const pieData = market?.floor_distribution ?? [];
  const pieColors = ["#2563eb", "#45a4ec", "#63c4b5", "#f0b660", "#9d8bd4"];
  return (
    <>
      <PageHeading eyebrow={`TỔNG QUAN · ${new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(new Date()).toLocaleUpperCase("vi-VN")}`} title="Bức tranh bất động sản" subtitle="Tổng quan dữ liệu nhà ở và hoạt động dự đoán của ESTATE AI." action={<Link className="button button-primary" to="/predict"><Sparkles size={17} /> Bắt đầu dự đoán</Link>} />
      {error && <div className="notice notice-error">{error}</div>}
      {busy ? <LoadingInline /> : <>
        <div className="stats-grid">
          <StatCard title="Bất động sản trong dữ liệu" value={shortNumber(stats?.property_count ?? 0)} note="Mẫu trong dataset gốc" icon={Building2} tone="blue" />
          <StatCard title="Lượt dự đoán" value={shortNumber(stats?.prediction_count ?? 0)} note="Lưu trong tài khoản người dùng" icon={Activity} tone="violet" />
          <StatCard title="Giá trung bình dữ liệu" value={billions(stats?.average_price_billion ?? 0)} note={`${money(stats?.average_price_vnd ?? 0)}`} icon={BarChart3} tone="green" />
          <StatCard title="Người dùng" value={shortNumber(stats?.user_count ?? 0)} note="Tài khoản đang hoạt động" icon={Users} tone="amber" />
        </div>
        <div className="dashboard-charts">
          <Card className="chart-card"><CardTitle title="Giá trung bình theo diện tích" subtitle="Giá trung bình (tỷ VNĐ) từ bộ dữ liệu" action={<span className="chart-legend"><i /> Giá trung bình</span>} />
            <div className="chart-wrap chart-large"><ResponsiveContainer width="100%" height="100%"><LineChart data={market?.average_by_area ?? []} margin={{ top: 18, right: 12, left: 0, bottom: 4 }}><CartesianGrid stroke="#eef1f6" vertical={false} /><XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#8290a5", fontSize: 11 }} /><YAxis tickLine={false} axisLine={false} tick={{ fill: "#8290a5", fontSize: 11 }} tickFormatter={(value: number) => `${value} tỷ`} width={55} /><Tooltip formatter={(value) => [billions(Number(value)), "Giá trung bình"]} contentStyle={{ borderRadius: 12, border: "1px solid #e8edf4", boxShadow: "0 8px 22px #172b4d12" }} /><Line type="monotone" dataKey="price_billion" stroke="#2563eb" strokeWidth={3} dot={{ fill: "#fff", stroke: "#2563eb", strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} /></LineChart></ResponsiveContainer></div>
          </Card>
          <Card className="chart-card"><CardTitle title="Tỷ lệ tin theo số tầng" subtitle="Tỷ lệ trên các mẫu có thông tin số tầng." />
            <div className="chart-wrap chart-large"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pieData} dataKey="count" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={3} stroke="none">{pieData.map((_, index) => <Cell key={index} fill={pieColors[index % pieColors.length]} />)}</Pie><Tooltip formatter={(value) => [shortNumber(Number(value)), "Tin đăng"]} contentStyle={{ borderRadius: 12, border: "1px solid #e8edf4" }} /><Legend verticalAlign="bottom" height={28} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: "#718198" }} /></PieChart></ResponsiveContainer></div>
          </Card>
        </div>
        <div className="dashboard-lower">
          <Card><CardTitle title="Dự đoán gần đây" subtitle="Lịch sử dự đoán của bạn" action={<Link className="link-button" to="/history">Xem tất cả <ArrowRight size={14} /></Link>} />
            {recent.length ? <div className="recent-list">{recent.map((item) => <div className="recent-item" key={item.id}><span className="recent-icon"><House size={16} /></span><span className="recent-info"><b>{item.address}</b><small>{item.area} m² · {dateTime(item.created_at)}</small></span><span className="recent-price">{billions(item.prediction_billion)}</span></div>)}</div> : <EmptyState title="Chưa có dự đoán nào" text="Kết quả bạn lưu sẽ xuất hiện tại đây." />}
          </Card>
          <Card className="model-status-card"><div className="model-badge"><span className="status-dot" /> MÔ HÌNH XGBOOST</div><h3>{stats?.model_status === "ready" ? "Mô hình sẵn sàng" : "Mô hình chưa khả dụng"}</h3><p>{stats?.model_status === "ready" ? "Pipeline đã huấn luyện đang được sử dụng để tạo dự đoán." : "Kiểm tra tệp mô hình trong thư mục models/."}</p><div className="model-divider" /><div className="model-info-row"><span>Diện tích trung vị dữ liệu</span><b>{(stats?.median_area ?? 0).toFixed(0)} m²</b></div><div className="model-info-row"><span>Đặc trưng đầu vào</span><b>7 trường gốc · 10 feature pipeline</b></div><Link to="/predict" className="button button-soft full-width">Thử dự đoán <ArrowRight size={16} /></Link></Card>
        </div>
        <div className="data-note"><CircleHelp size={15} /> Dataset không có dữ liệu thời gian, loại nhà hoặc quận/huyện tách riêng; biểu đồ chỉ phản ánh các trường hiện có.</div>
      </>}
    </>
  );
}

function PredictionPage() {
  const [area, setArea] = useState("68");
  const [floors, setFloors] = useState("3");
  const [bedrooms, setBedrooms] = useState("3");
  const [bathrooms, setBathrooms] = useState("2");
  const [frontage, setFrontage] = useState("");
  const [accessRoad, setAccessRoad] = useState("");
  const [legalStatus, setLegalStatus] = useState("");
  const [address, setAddress] = useState("");
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState<number | null>(null);
  const [market, setMarket] = useState<MarketStats | null>(null);
  const [comparison, setComparison] = useState<PredictionResult[]>([]);

  useEffect(() => { api.market().then(setMarket).catch(() => setMarket(null)); }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setResult(null);
    const areaValue = Number(area);
    if (!Number.isFinite(areaValue) || areaValue <= 0) {
      setError("Diện tích phải lớn hơn 0 m².");
      return;
    }
    const numericValue = (value: string, label: string, minimum: number, maximum: number) => {
      if (!value.trim()) return null;
      const number = Number(value);
      if (!Number.isFinite(number) || number < minimum || number > maximum) throw new Error(`${label} phải từ ${minimum} đến ${maximum}.`);
      return number;
    };
    let input: PredictionInput;
    try {
      input = {
        Area: areaValue,
        Floors: numericValue(floors, "Số tầng", 1, 100),
        Bedrooms: numericValue(bedrooms, "Số phòng ngủ", 1, 100),
        Bathrooms: numericValue(bathrooms, "Số phòng tắm", 1, 100),
        Frontage: numericValue(frontage, "Mặt tiền", 0, 1000),
        "Access road": numericValue(accessRoad, "Đường vào", 0, 1000),
        "Legal status": legalStatus || null,
        ...(address.trim() ? { address: address.trim() } : {}),
      };
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Thông tin nhập chưa hợp lệ.");
      return;
    }
    setBusy(true);
    try {
      const response = await api.predict(input);
      setResult(response);
      const band = market?.average_by_area.find((item) => {
        const [low, high] = item.name.match(/\d+/g)?.map(Number) ?? [];
        return item.name.includes("Dưới") ? areaValue < (high ?? 30) : item.name.includes("Trên") ? areaValue > (low ?? 120) : areaValue >= (low ?? 0) && areaValue <= (high ?? Infinity);
      });
      setReference(band?.price_billion ?? null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể dự đoán giá.");
    } finally {
      setBusy(false);
    }
  }

  function clearForm() {
    setArea("");
    setFloors("");
    setBedrooms("");
    setBathrooms("");
    setFrontage("");
    setAccessRoad("");
    setLegalStatus("");
    setAddress("");
    setResult(null);
    setError("");
  }

  function addToComparison() {
    if (!result || comparison.some((item) => item.id === result.id)) return;
    if (comparison.length >= 4) {
      setError("Chỉ có thể so sánh tối đa 4 kịch bản.");
      return;
    }
    setComparison((items) => [...items, result]);
    setError("");
  }

  return (
    <>
      <PageHeading eyebrow="MÔ HÌNH XGBOOST" title="Dự đoán giá nhà" subtitle="Nhập các đặc trưng có trong pipeline đã huấn luyện để nhận mức giá tham khảo." />
      <div className="prediction-layout">
        <Card className="prediction-form-card">
          <div className="form-step"><span>01</span><div><b>Thông tin bất động sản</b><small>Các trường có dấu * là bắt buộc</small></div></div>
          <form onSubmit={submit}>
            <div className="form-section-title"><span className="section-icon"><MapPin size={16} /></span><div><b>Thông tin địa chỉ</b><small>Chỉ dùng để lưu trong lịch sử, không phải đầu vào của mô hình.</small></div></div>
            <Field label="Địa chỉ tham khảo" help="Dataset có cột Address nhưng pipeline XGBoost hiện không sử dụng địa chỉ để dự đoán."><input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành" /></Field>
            <div className="form-section-title"><span className="section-icon section-icon-blue"><House size={16} /></span><div><b>Đặc điểm căn nhà</b><small>Khớp với đặc trưng đầu vào đã huấn luyện.</small></div></div>
            <div className="form-grid">
              <Field label="Diện tích đất *" suffix="m²"><input type="number" min="0.1" max="100000" step="0.1" value={area} onChange={(event) => setArea(event.target.value)} required placeholder="68" /></Field>
              <Field label="Số tầng" suffix="tầng" help="Có thể bỏ trống nếu chưa có thông tin."><input type="number" min="1" max="100" step="1" value={floors} onChange={(event) => setFloors(event.target.value)} placeholder="Chưa rõ" /></Field>
              <Field label="Phòng ngủ" suffix="phòng"><input type="number" min="1" max="100" step="1" value={bedrooms} onChange={(event) => setBedrooms(event.target.value)} placeholder="Chưa rõ" /></Field>
              <Field label="Phòng tắm" suffix="phòng"><input type="number" min="1" max="100" step="1" value={bathrooms} onChange={(event) => setBathrooms(event.target.value)} placeholder="Chưa rõ" /></Field>
              <Field label="Mặt tiền" suffix="m" help="Để trống nếu không có dữ liệu."><input type="number" min="0" max="1000" step="0.1" value={frontage} onChange={(event) => setFrontage(event.target.value)} placeholder="Không có thông tin" /></Field>
              <Field label="Đường vào" suffix="m" help="Để trống nếu không có dữ liệu."><input type="number" min="0" max="1000" step="0.1" value={accessRoad} onChange={(event) => setAccessRoad(event.target.value)} placeholder="Không có thông tin" /></Field>
              <Field label="Tình trạng pháp lý" className="field-full"><select value={legalStatus} onChange={(event) => setLegalStatus(event.target.value)}><option value="">Chưa có thông tin</option><option value="Have certificate">Đã có giấy chứng nhận</option><option value="Sale contract">Hợp đồng mua bán</option></select></Field>
            </div>
            <div className="model-input-note"><CircleHelp size={15} /><span>Mô hình không sử dụng vị trí, hướng nhà, nội thất hoặc loại bất động sản. Các trường không có dữ liệu được xử lý theo pipeline đã lưu.</span></div>
            {error && <div className="inline-error">{error}</div>}
            <div className="form-actions"><button type="button" className="button button-outline" onClick={clearForm}><X size={16} /> Xóa dữ liệu</button><button className="button button-primary" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />}{busy ? "Đang phân tích…" : "Dự đoán giá nhà"}<ArrowRight size={16} /></button></div>
          </form>
        </Card>
        <div className="result-column">
          <Card className={`result-card ${result ? "result-ready" : ""}`}>
            <div className="result-card-head"><span className="result-icon"><Sparkles size={19} /></span><span className="result-model">KẾT QUẢ XGBOOST</span>{result && <span className="result-check"><Check size={14} /> Đã lưu</span>}</div>
            <div className="result-label">Giá nhà dự đoán</div>
            {result ? <><div className="result-price">{billions(result.prediction_billion)}</div><div className="result-exact">{money(result.prediction_vnd)}</div><div className="result-disclaimer">Giá tham khảo do mô hình XGBoost ước tính, không phải cam kết giao dịch.</div></> : <><div className="result-empty-price">— — —</div><div className="result-placeholder">Điền thông tin căn nhà và bắt đầu dự đoán.</div></>}
            <div className="result-divider" />
            {result ? <div className="result-compare"><div className="compare-heading"><span>So sánh nhóm diện tích</span><span>Đơn vị: tỷ VNĐ</span></div><div className="compare-bars"><div><span>Mô hình</span><div className="bar-track"><i style={{ width: "100%" }} /></div><b>{result.prediction_billion.toFixed(2)}</b></div>{reference !== null && <div><span>Trung bình nhóm</span><div className="bar-track compare-muted"><i style={{ width: `${Math.min(100, (reference / Math.max(result.prediction_billion, reference)) * 100)}%` }} /></div><b>{reference.toFixed(2)}</b></div>}</div><div className="result-buttons"><button className="button button-outline" onClick={() => window.print()}><FileText size={15} /> In / PDF</button><button className="button button-soft" onClick={addToComparison} disabled={comparison.some((item) => item.id === result.id) || comparison.length >= 4}><BarChart3 size={15} /> {comparison.some((item) => item.id === result.id) ? "Đã thêm so sánh" : "So sánh kịch bản"}</button><button className="button button-soft" onClick={() => { setResult(null); setError(""); }}><Plus size={15} /> Dự đoán mới</button></div></div> : <div className="result-details"><div className="result-details-title">Thông tin mô hình</div><div className="result-detail"><span>Thuật toán</span><b>XGBoost Regressor</b></div><div className="result-detail"><span>Đặc trưng đầu vào</span><b>7 trường gốc · 10 feature pipeline</b></div><div className="result-detail"><span>Đơn vị giá mô hình</span><b>Tỷ VNĐ</b></div></div>}
          </Card>
          <div className="trust-note"><ShieldCheck size={16} /><span><b>Minh bạch dữ liệu</b><br />Không hiển thị phần trăm chính xác cho từng căn nhà. Độ tin cậy phụ thuộc vào tập dữ liệu và các đặc trưng nhập vào.</span></div>
        </div>
      </div>
      {comparison.length > 0 && <Card className="comparison-card">
        <CardTitle title="So sánh kịch bản" subtitle={`${comparison.length}/4 kịch bản · Mỗi lần dự đoán mới sẽ được lưu vào lịch sử.`} action={<button className="text-button" onClick={() => setComparison([])}>Xóa danh sách</button>} />
        <div className="chart-wrap comparison-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={comparison.map((item, index) => ({ name: `Kịch bản ${index + 1}`, price: item.prediction_billion }))} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}><CartesianGrid stroke="#eef1f6" vertical={false} /><XAxis dataKey="name" tickLine={false} axisLine={false} /><YAxis tickLine={false} axisLine={false} tickFormatter={(value: number) => `${value} tỷ`} /><Tooltip formatter={(value) => [billions(Number(value)), "Giá dự đoán"]} /><Bar dataKey="price" name="Giá dự đoán" fill="#2878e5" radius={[7, 7, 0, 0]} /></BarChart></ResponsiveContainer></div>
        <div className="comparison-list">{comparison.map((item, index) => <div className="comparison-row" key={item.id}><span><b>Kịch bản {index + 1}</b><small>{[item.address, `${item.inputs.Area} m²`, item.inputs.Floors && `${item.inputs.Floors} tầng`, item.inputs.Bedrooms && `${item.inputs.Bedrooms} phòng ngủ`].filter(Boolean).join(" · ")}</small></span><strong>{billions(item.prediction_billion)}</strong><button className="table-icon-button" aria-label={`Xóa kịch bản ${index + 1}`} onClick={() => setComparison((items) => items.filter((scenario) => scenario.id !== item.id))}><X size={15} /></button></div>)}</div>
      </Card>}
    </>
  );
}

function MarketPage() {
  const [data, setData] = useState<MarketStats | null>(null);
  const [error, setError] = useState("");
  const [areaGroup, setAreaGroup] = useState("all");
  const [minArea, setMinArea] = useState("");
  const [maxArea, setMaxArea] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const filters = {
        ...(minArea ? { min_area: Number(minArea) } : {}),
        ...(maxArea ? { max_area: Number(maxArea) } : {}),
        ...(minPrice ? { min_price: Number(minPrice) } : {}),
        ...(maxPrice ? { max_price: Number(maxPrice) } : {}),
      };
      api.market(filters)
        .then((result) => { setData(result); setError(""); })
        .catch((reason) => setError(reason instanceof Error ? reason.message : "Không tải được phân tích."));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [minArea, maxArea, minPrice, maxPrice]);
  const areaData = data?.average_by_area.filter((item) => areaGroup === "all" || item.name === areaGroup) ?? [];
  function clearFilters() {
    setAreaGroup("all");
    setMinArea("");
    setMaxArea("");
    setMinPrice("");
    setMaxPrice("");
  }
  return (
    <>
      <PageHeading eyebrow="PHÂN TÍCH DỮ LIỆU" title="Phân tích thị trường" subtitle={data ? `${shortNumber(data.property_count)} mẫu phù hợp với bộ lọc hiện tại.` : "Khám phá phân bố giá theo các đặc trưng thực tế của bộ dữ liệu nhà ở."} action={<span className="data-source-pill"><Activity size={14} /> vietnam_housing_dataset.csv</span>} />
      {error && <div className="notice notice-error">{error}</div>}
      <Card className="filters-card"><div className="filter-title"><SlidersHorizontal size={17} /><b>Bộ lọc phân tích</b></div><div className="filter-fields market-filter-fields">
        <label><span>Nhóm diện tích</span><select value={areaGroup} onChange={(event) => setAreaGroup(event.target.value)}><option value="all">Tất cả diện tích</option>{data?.average_by_area.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label>
        <Field label="Diện tích từ" suffix="m²"><input type="number" min="0" value={minArea} onChange={(event) => setMinArea(event.target.value)} placeholder="Không giới hạn" /></Field>
        <Field label="Đến" suffix="m²"><input type="number" min="0" value={maxArea} onChange={(event) => setMaxArea(event.target.value)} placeholder="Không giới hạn" /></Field>
        <Field label="Giá từ" suffix="tỷ"><input type="number" min="0" step="0.1" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} placeholder="Không giới hạn" /></Field>
        <Field label="Đến" suffix="tỷ"><input type="number" min="0" step="0.1" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} placeholder="Không giới hạn" /></Field>
        <button className="button button-outline" onClick={clearFilters}><X size={14} /> Xóa bộ lọc</button>
      </div></Card>
      {!data ? <LoadingInline /> : <div className="market-grid">
        <Card className="market-chart-wide"><CardTitle title="Giá trung bình theo diện tích" subtitle="Giá rao bán trung bình của từng nhóm diện tích, tỷ VNĐ." />
          <div className="chart-wrap market-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={areaData} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}><CartesianGrid stroke="#edf0f5" vertical={false} /><XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#7b899d", fontSize: 11 }} /><YAxis tickLine={false} axisLine={false} tick={{ fill: "#7b899d", fontSize: 11 }} tickFormatter={(value: number) => `${value} tỷ`} /><Tooltip formatter={(value) => [billions(Number(value)), "Giá trung bình"]} /><Bar dataKey="price_billion" name="Giá trung bình" fill="#2878e5" radius={[7, 7, 0, 0]} maxBarSize={62} /></BarChart></ResponsiveContainer></div>
        </Card>
        <Card><CardTitle title="Giá theo số tầng" subtitle="Giá trung bình theo số tầng." /><div className="chart-wrap market-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.average_by_floors} margin={{ top: 12, right: 12, left: -12, bottom: 0 }}><CartesianGrid stroke="#edf0f5" vertical={false} /><XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#7b899d", fontSize: 10 }} /><YAxis tickLine={false} axisLine={false} tick={{ fill: "#7b899d", fontSize: 10 }} /><Tooltip formatter={(value) => [billions(Number(value)), "Giá trung bình"]} /><Bar dataKey="price_billion" fill="#61b2a1" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div></Card>
        <Card><CardTitle title="Phân bố giá rao bán" subtitle="Số lượng tin theo khoảng giá." /><div className="chart-wrap market-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.price_distribution} margin={{ top: 12, right: 4, left: -15, bottom: 25 }}><CartesianGrid stroke="#edf0f5" vertical={false} /><XAxis dataKey="name" tickLine={false} axisLine={false} angle={-28} textAnchor="end" interval={0} tick={{ fill: "#7b899d", fontSize: 9 }} /><YAxis tickLine={false} axisLine={false} tick={{ fill: "#7b899d", fontSize: 10 }} /><Tooltip formatter={(value) => [shortNumber(Number(value)), "Tin đăng"]} /><Bar dataKey="count" fill="#8a7bd4" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div></Card>
        <Card className="market-limitations"><CardTitle title="Giới hạn dữ liệu" subtitle="Các phân tích dưới đây chưa thể thực hiện do thiếu trường tương ứng." /><div className="limitation-list">{Object.values(data.limitations).map((item) => <div key={item}><span className="limitation-dot" />{item}</div>)}</div></Card>
      </div>}
      <div className="data-note"><CircleHelp size={15} /> Giá trong dữ liệu được lưu theo tỷ VNĐ. Bộ lọc diện tích và giá áp dụng đồng thời lên các biểu đồ; đây là dữ liệu tham khảo, không phải giá giao dịch.</div>
    </>
  );
}

function MapPage() {
  const [search, setSearch] = useState("");
  const [data, setData] = useState<MapProperties | null>(null);
  const [error, setError] = useState("");
  const [minArea, setMinArea] = useState("");
  const [maxArea, setMaxArea] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const filters = {
        ...(minArea ? { min_area: Number(minArea) } : {}),
        ...(maxArea ? { max_area: Number(maxArea) } : {}),
        ...(minPrice ? { min_price: Number(minPrice) } : {}),
        ...(maxPrice ? { max_price: Number(maxPrice) } : {}),
      };
      api.mapProperties(search, filters)
        .then((result) => { setData(result); setError(""); })
        .catch((reason) => setError(reason instanceof Error ? reason.message : "Không tải được dữ liệu bản đồ."));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search, minArea, maxArea, minPrice, maxPrice]);
  function clearFilters() {
    setSearch("");
    setMinArea("");
    setMaxArea("");
    setMinPrice("");
    setMaxPrice("");
  }
  return (
    <>
      <PageHeading eyebrow="KHÁM PHÁ KHÔNG GIAN" title="Khám phá bất động sản" subtitle="Tìm và lọc các hồ sơ trong bộ dữ liệu theo địa chỉ, diện tích và khoảng giá." />
      {error && <div className="notice notice-error">{error}</div>}
      <div className="map-layout">
        <Card className="map-card">
          <div className="map-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm trong địa chỉ của bộ dữ liệu…" /></div>
          <div className="map-filters">
            <Field label="Diện tích từ" suffix="m²"><input type="number" min="0" value={minArea} onChange={(event) => setMinArea(event.target.value)} placeholder="Tất cả" /></Field>
            <Field label="Đến" suffix="m²"><input type="number" min="0" value={maxArea} onChange={(event) => setMaxArea(event.target.value)} placeholder="Tất cả" /></Field>
            <Field label="Giá từ" suffix="tỷ"><input type="number" min="0" step="0.1" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} placeholder="Tất cả" /></Field>
            <Field label="Đến" suffix="tỷ"><input type="number" min="0" step="0.1" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} placeholder="Tất cả" /></Field>
            <button className="button button-outline" onClick={clearFilters}><X size={14} /> Xóa bộ lọc</button>
          </div>
          <div className="map-view"><MapContainer center={[16.2, 106.3]} zoom={5} scrollWheelZoom className="leaflet-map"><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /></MapContainer><div className="map-warning"><MapPin size={19} /><div><b>Chưa thể hiển thị vị trí chính xác</b><span>{data?.notice ?? "Bộ dữ liệu gốc không có vĩ độ/kinh độ."}</span></div></div></div>
          <div className="map-footer"><span><span className="status-dot" /> Bản đồ nền OpenStreetMap · bản đồ tham khảo</span><span>{data ? `${shortNumber(data.total)} địa chỉ phù hợp` : "Đang tải…"}</span></div>
        </Card>
        <Card className="map-list-card"><CardTitle title="Địa chỉ trong dữ liệu" subtitle="Vị trí không được suy đoán vì dataset không cung cấp tọa độ." /><div className="address-list">{data?.items.length ? data.items.map((item, index) => <div className="address-item" key={`${item.address}-${index}`}><span className="address-pin"><MapPin size={15} /></span><span className="address-text"><b>{item.address}</b><small>{item.area ? `${item.area} m²` : "Chưa có diện tích"} · {item.price_billion ? billions(item.price_billion) : "Chưa có giá"}</small><em>{item.location_precision}</em></span></div>) : <EmptyState title="Không tìm thấy địa chỉ" text="Thử điều chỉnh từ khóa hoặc bộ lọc." />}</div></Card>
      </div>
    </>
  );
}

function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const pageSize = 10;

  async function refresh(nextPage = page, nextSearch = search) {
    setLoading(true);
    setError("");
    try {
      const data = await api.history(nextPage, nextSearch, pageSize);
      setItems(data.items);
      setTotal(data.total);
      setPage(nextPage);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tải lịch sử.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void refresh(1, ""); }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(1, search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  async function remove(item: HistoryItem) {
    if (!window.confirm(`Xóa kết quả dự đoán ${item.code}?`)) return;
    try {
      await api.deleteHistory(item.id);
      await refresh(Math.max(1, page - (items.length === 1 ? 1 : 0)));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể xóa kết quả.");
    }
  }

  function exportCsv() {
    const rows = [["Mã dự đoán", "Địa chỉ", "Diện tích (m²)", "Giá dự đoán (tỷ VNĐ)", "Ngày dự đoán"], ...items.map((item) => [item.code, item.address, String(item.area), String(item.prediction_billion), dateTime(item.created_at)])];
    const content = `\uFEFF${rows.map((row) => row.map((field) => `"${field.replace(/"/g, '""')}"`).join(",")).join("\n")}`;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
    link.download = "lich-su-du-doan.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <>
      <PageHeading eyebrow="CÁ NHÂN" title="Lịch sử dự đoán" subtitle="Theo dõi và quản lý các kết quả bạn đã lưu." action={<button className="button button-outline" onClick={exportCsv} disabled={!items.length}><Download size={16} /> Xuất Excel / CSV</button>} />
      <Card className="history-card"><div className="history-tools"><div className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm theo địa chỉ…" /></div><div className="history-filter"><span>Lịch sử cá nhân</span><ChevronDown size={15} /></div></div>
        {error && <div className="notice notice-error">{error}</div>}
        {loading ? <LoadingInline /> : items.length ? <>
          <div className="table-scroll"><table className="data-table"><thead><tr><th>MÃ DỰ ĐOÁN</th><th>ĐỊA CHỈ</th><th>DIỆN TÍCH</th><th>GIÁ DỰ ĐOÁN</th><th>NGÀY DỰ ĐOÁN</th><th>TRẠNG THÁI</th><th /></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><b className="table-code">{item.code}</b></td><td><span className="table-address">{item.address}</span></td><td>{item.area} m²</td><td><b className="table-price">{billions(item.prediction_billion)}</b></td><td>{dateTime(item.created_at)}</td><td><span className="status-tag"><span /> {item.status}</span></td><td><button className="table-icon-button delete-button" onClick={() => void remove(item)} aria-label="Xóa lịch sử"><Trash2 size={16} /></button></td></tr>)}</tbody></table></div>
          <div className="table-pagination"><span>Hiển thị {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} trong {shortNumber(total)} kết quả</span><div><button disabled={page <= 1} onClick={() => void refresh(page - 1)} aria-label="Trang trước"><ChevronLeft size={17} /></button><span>Trang {page} / {Math.max(1, Math.ceil(total / pageSize))}</span><button disabled={page >= Math.ceil(total / pageSize)} onClick={() => void refresh(page + 1)} aria-label="Trang sau"><ChevronRight size={17} /></button></div></div>
        </> : <EmptyState title="Chưa có lịch sử dự đoán" text="Kết quả dự đoán được lưu sau khi đăng nhập sẽ xuất hiện tại đây." action={<Link className="button button-primary" to="/predict"><Sparkles size={16} /> Dự đoán ngay</Link>} />}
      </Card>
    </>
  );
}

function AdminPage() {
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [addingUser, setAddingUser] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<User["role"]>("user");
  const [exporting, setExporting] = useState(false);
  const currentUser = useAuth().user;

  async function refresh() {
    setLoading(true);
    try {
      const [overview, userPage] = await Promise.all([api.adminSummary(), api.adminUsers()]);
      setSummary(overview);
      setUsers(userPage.items);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tải bảng quản trị.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void refresh(); }, []);
  async function changeUser(user: User, changes: Partial<Pick<User, "role" | "is_active">>) {
    try {
      await api.updateUser(user.id, changes);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể cập nhật tài khoản.");
    }
  }
  async function removeUser(user: User) {
    if (!window.confirm(`Xóa tài khoản ${user.email} và lịch sử dự đoán của tài khoản này?`)) return;
    try {
      await api.deleteUser(user.id);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể xóa tài khoản.");
    }
  }
  async function addUser(event: FormEvent) {
    event.preventDefault();
    try {
      await api.createAdminUser({
        name: newUserName,
        email: newUserEmail,
        password: newUserPassword,
        role: newUserRole,
      });
      setAddingUser(false);
      setNewUserName("");
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserRole("user");
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tạo tài khoản.");
    }
  }

  async function exportDataset() {
    setError("");
    setExporting(true);
    try {
      const file = await api.downloadDataset();
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = "vietnam_housing_dataset.csv";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể xuất dữ liệu.");
    } finally {
      setExporting(false);
    }
  }

  return <>
    <PageHeading eyebrow="QUẢN TRỊ" title="Quản trị hệ thống" subtitle="Tổng quan hoạt động, trạng thái mô hình và quyền truy cập." action={<button className="button button-primary" onClick={() => setAddingUser(!addingUser)}><Plus size={16} /> Thêm tài khoản</button>} />
    {error && <div className="notice notice-error">{error}</div>}
    {loading ? <LoadingInline /> : summary && <>
      <div className="stats-grid admin-stats"><StatCard title="Người dùng" value={shortNumber(summary.user_count)} note="Tài khoản đã đăng ký" icon={Users} tone="blue" /><StatCard title="Lượt dự đoán" value={shortNumber(summary.prediction_count)} note="Kết quả đã lưu" icon={Activity} tone="violet" /><StatCard title="Bất động sản" value={shortNumber(summary.property_count)} note="Mẫu trong dataset gốc" icon={Building2} tone="green" /><StatCard title="Mô hình" value={summary.model.status === "ready" ? "Sẵn sàng" : "Lỗi"} note={summary.model.artifact} icon={ShieldCheck} tone="amber" /></div>
      <div className="admin-grid"><Card><CardTitle title="Quản lý người dùng" subtitle="Cập nhật quyền và trạng thái tài khoản." />
        {addingUser && <form className="admin-add-form" onSubmit={(event) => void addUser(event)}><Field label="Họ và tên"><input value={newUserName} onChange={(event) => setNewUserName(event.target.value)} required minLength={2} placeholder="Nguyễn Minh Anh" /></Field><Field label="Email"><input type="email" value={newUserEmail} onChange={(event) => setNewUserEmail(event.target.value)} required placeholder="email@example.com" /></Field><Field label="Mật khẩu"><input type="password" value={newUserPassword} onChange={(event) => setNewUserPassword(event.target.value)} required minLength={8} placeholder="Tối thiểu 8 ký tự" /></Field><Field label="Vai trò"><select value={newUserRole} onChange={(event) => setNewUserRole(event.target.value as User["role"])}><option value="user">Người dùng</option><option value="admin">Quản trị viên</option></select></Field><button className="button button-primary"><Plus size={15} /> Tạo tài khoản</button></form>}
        <div className="table-scroll"><table className="data-table admin-user-table"><thead><tr><th>TÀI KHOẢN</th><th>NGÀY TẠO</th><th>VAI TRÒ</th><th>TRẠNG THÁI</th><th /></tr></thead><tbody>{users.map((item) => <tr key={item.id}><td><b>{item.name}</b><small className="user-email">{item.email}</small></td><td>{new Date(item.created_at).toLocaleDateString("vi-VN")}</td><td><select value={item.role} disabled={item.id === currentUser?.id} onChange={(event) => void changeUser(item, { role: event.target.value as User["role"] })}><option value="user">Người dùng</option><option value="admin">Quản trị viên</option></select></td><td><button className={`toggle-status ${item.is_active ? "is-active" : ""}`} onClick={() => void changeUser(item, { is_active: !item.is_active })} disabled={item.id === currentUser?.id}><i />{item.is_active ? "Đang hoạt động" : "Đã khóa"}</button></td><td><button className="table-icon-button delete-button" aria-label="Xóa tài khoản" onClick={() => void removeUser(item)} disabled={item.id === currentUser?.id}><Trash2 size={15} /></button></td></tr>)}</tbody></table></div></Card>
      <div className="admin-side"><Card><CardTitle title="Mô hình AI" subtitle="Trạng thái artifact đang được tải." /><div className="admin-model-title"><span className={`model-status-dot ${summary.model.status === "ready" ? "" : "offline"}`} /><b>{summary.model.name}</b></div><div className="admin-detail"><span>Tệp mô hình</span><b>{summary.model.artifact}</b></div><div className="admin-detail"><span>Đặc trưng pipeline</span><b>{summary.model.features.length}</b></div><div className="admin-feature-tags">{summary.model.features.map((feature) => <span key={feature}>{feature}</span>)}</div><div className="notice notice-info">{summary.model.metrics_note}</div></Card>
        <Card><CardTitle title="Dữ liệu huấn luyện" subtitle={`${shortNumber(summary.dataset.rows)} dòng · ${summary.dataset.columns.length} cột`} /><div className="missing-list">{Object.entries(summary.dataset.missing_values).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([field, count]) => <div key={field}><span>{field}</span><b>{shortNumber(count)}</b></div>)}</div><div className="notice notice-info">Dataset chỉ đọc trong ứng dụng. Kiểm tra chất lượng và huấn luyện lại mô hình trước khi thay đổi dữ liệu dùng cho dự đoán.</div><button className="button button-outline full-width" onClick={() => void exportDataset()} disabled={exporting}><Download size={15} />{exporting ? "Đang xuất dữ liệu…" : "Tải dataset CSV"}</button></Card></div>
      </div>
    </>}
  </>;
}

function Field({ label, children, suffix, help, className = "" }: { label: string; children: ReactNode; suffix?: string; help?: string; className?: string }) {
  return <label className={`field ${className}`}><span className="field-label">{label}{help && <span className="field-help" title={help}><CircleHelp size={13} /></span>}</span><span className={`field-control ${suffix ? "has-suffix" : ""}`}>{children}{suffix && <i>{suffix}</i>}</span></label>;
}

function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return <div className="empty-state"><span className="empty-icon"><FileText size={20} /></span><b>{title}</b><p>{text}</p>{action}</div>;
}

function LoadingInline() {
  return <div className="loading-inline"><LoaderCircle size={20} className="spin" /> Đang tải dữ liệu…</div>;
}

export default App;
