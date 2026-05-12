import { useState, useMemo, useCallback } from "react";
import {
  Button, Card, Collapse, Divider, Form, Input, Modal, Popconfirm, Select,
  Space, Switch, Table, Tag, Tooltip, Typography, message,
} from "antd";
import {
  PlusOutlined, DeleteOutlined, EditOutlined, SendOutlined,
  EyeOutlined, ClockCircleOutlined, CopyOutlined,
} from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from "react-query";
import { CronExpressionParser } from "cron-parser";
import {
  tapdBugApi,
  type TapdBugReportConfig, type TapdBugFilters,
  type TapdReportTemplate, type TapdMetric,
} from "../api/api-regression";

// ── 频率 / 时间下拉选项 ─────────────────────────
type Frequency = "daily" | "workday" | "weekly" | "monthly";
const FREQ_OPTIONS: { label: string; value: Frequency }[] = [
  { label: "每天", value: "daily" }, { label: "工作日", value: "workday" },
  { label: "每周", value: "weekly" }, { label: "每月", value: "monthly" },
];
const WEEKDAY_OPTIONS = [
  { label: "周一", value: 1 }, { label: "周二", value: 2 }, { label: "周三", value: 3 },
  { label: "周四", value: 4 }, { label: "周五", value: 5 }, { label: "周六", value: 6 }, { label: "周日", value: 0 },
];
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({ label: `${String(i).padStart(2, "0")} 时`, value: i }));
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => ({ label: `${String(i).padStart(2, "0")} 分`, value: i }));
const MONTHDAY_OPTIONS = Array.from({ length: 31 }, (_, i) => ({ label: `${i + 1} 日`, value: i + 1 }));

const TIME_FIELD_OPTIONS = [
  { label: "不限时间（累计）", value: "" },
  { label: "今日创建", value: "created" },
  { label: "今日关闭", value: "closed" },
  { label: "今日修改", value: "modified" },
];
const COLOR_OPTIONS = [
  { label: "警告色（橙）", value: "warning" },
  { label: "信息色（绿）", value: "info" },
  { label: "评论色（灰）", value: "comment" },
];

// ── Cron 工具 ────────────────────────────────────
function buildCron(f: Frequency, h: number, m: number, wd?: number, md?: number) {
  switch (f) {
    case "daily": return `${m} ${h} * * *`; case "workday": return `${m} ${h} * * 1-5`;
    case "weekly": return `${m} ${h} * * ${wd ?? 1}`; case "monthly": return `${m} ${h} ${md ?? 1} * *`;
  }
}
function parseCron(cron: string) {
  const p = cron.trim().split(/\s+/);
  if (p.length !== 5) return { freq: "workday" as Frequency, hour: 18, minute: 0, weekday: 1, monthday: 1 };
  const [m, h, dom, , dow] = p;
  const hour = parseInt(h) || 0, minute = parseInt(m) || 0;
  if (dow === "1-5") return { freq: "workday" as Frequency, hour, minute, weekday: 1, monthday: 1 };
  if (dom !== "*") return { freq: "monthly" as Frequency, hour, minute, weekday: 1, monthday: parseInt(dom) || 1 };
  if (dow !== "*") return { freq: "weekly" as Frequency, hour, minute, weekday: parseInt(dow) || 1, monthday: 1 };
  return { freq: "daily" as Frequency, hour, minute, weekday: 1, monthday: 1 };
}
function descCron(f: Frequency, h: number, m: number, wd?: number, md?: number) {
  const t = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  switch (f) { case "daily": return `每天 ${t}`; case "workday": return `工作日 ${t}`;
    case "weekly": return `每${WEEKDAY_OPTIONS.find(w => w.value === wd)?.label ?? "周一"} ${t}`;
    case "monthly": return `每月 ${md ?? 1} 日 ${t}`; }
}
function cronReadable(c: string) { const p = parseCron(c); return descCron(p.freq, p.hour, p.minute, p.weekday, p.monthday); }
function nextTimes(expr: string, n = 5) {
  try { return CronExpressionParser.parse(expr).take(n).map(d => d.toDate().toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })); } catch { return []; }
}

function CronPreview({ freq, hour, minute, weekday, monthday }: { freq: Frequency; hour: number; minute: number; weekday?: number; monthday?: number }) {
  const expr = buildCron(freq, hour, minute, weekday, monthday);
  const times = useMemo(() => nextTimes(expr), [expr]);
  return (<div style={{ padding: "10px 0" }}>
    <Space size={4} align="center" style={{ marginBottom: 6 }}>
      <ClockCircleOutlined style={{ color: "#1677ff" }} /><Typography.Text strong style={{ fontSize: 13 }}>{descCron(freq, hour, minute, weekday, monthday)}</Typography.Text><Tag style={{ fontSize: 11, margin: 0 }}>{expr}</Tag>
    </Space>
    {times.length > 0 && <div style={{ marginTop: 4 }}><Typography.Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>接下来 {times.length} 次执行时间：</Typography.Text>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>{times.map((t, i) => <Tag key={i} style={{ fontSize: 12, margin: 0, width: "fit-content" }} color={i === 0 ? "blue" : undefined}>{t}</Tag>)}</div></div>}
  </div>);
}

function filtersToTags(f: TapdBugFilters) {
  const l: Record<string, string> = { title: "标题", creator: "创建人", current_owner: "处理人", status: "状态", priority: "优先级", severity: "严重程度" };
  return Object.entries(l).filter(([k]) => (f as Record<string, string | undefined>)[k]).map(([k, v]) => `${v}: ${(f as Record<string, string>)[k]}`);
}

// ── 指标编辑器 ───────────────────────────────────
function MetricEditor({ metrics, onChange }: { metrics: TapdMetric[]; onChange: (m: TapdMetric[]) => void }) {
  const addMetric = () => onChange([...metrics, { label: "", color: "warning", countParams: {}, timeField: null }]);
  const removeMetric = (i: number) => onChange(metrics.filter((_, idx) => idx !== i));
  const updateMetric = (i: number, patch: Partial<TapdMetric>) => {
    const next = [...metrics]; next[i] = { ...next[i], ...patch }; onChange(next);
  };
  return (<div>
    {metrics.map((m, i) => (
      <Card key={i} size="small" style={{ marginBottom: 8 }} extra={<Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => removeMetric(i)} />}>
        <Space size={12} wrap style={{ width: "100%" }}>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>指标名称</Typography.Text>
            <Input size="small" value={m.label} onChange={e => updateMetric(i, { label: e.target.value })} placeholder="如：剩余 Bug" style={{ width: 140 }} />
          </div>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>时间范围</Typography.Text>
            <Select size="small" value={m.timeField || ""} onChange={v => updateMetric(i, { timeField: v || null })} options={TIME_FIELD_OPTIONS} style={{ width: 140 }} />
          </div>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>颜色</Typography.Text>
            <Select size="small" value={m.color} onChange={v => updateMetric(i, { color: v })} options={COLOR_OPTIONS} style={{ width: 140 }} />
          </div>
        </Space>
        <div style={{ marginTop: 8 }}>
          <Typography.Text type="secondary" style={{ fontSize: 11 }}>附加查询条件（如状态过滤）</Typography.Text>
          <Input size="small" value={Object.entries(m.countParams).map(([k, v]) => `${k}=${v}`).join(", ")}
            onChange={e => {
              const params: Record<string, string> = {};
              e.target.value.split(",").forEach(p => { const [k, ...v] = p.split("="); if (k?.trim() && v.length) params[k.trim()] = v.join("=").trim(); });
              updateMetric(i, { countParams: params });
            }}
            placeholder="如：status=new|open|reopened" />
        </div>
      </Card>
    ))}
    <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addMetric} block>添加指标</Button>
  </div>);
}

// ══════════════════════════════════════════════════
//  主组件
// ══════════════════════════════════════════════════
export default function TapdBugReport() {
  const qc = useQueryClient();
  const { data: configs = [], isLoading: configsLoading } = useQuery("tapd-bug-configs", tapdBugApi.configs.list);
  const { data: templates = [], isLoading: templatesLoading } = useQuery("tapd-bug-templates", tapdBugApi.templates.list);

  // ── 模板弹窗 ──
  const [tplOpen, setTplOpen] = useState(false);
  const [editingTpl, setEditingTpl] = useState<TapdReportTemplate | null>(null);
  const [tplForm] = Form.useForm();
  const [tplMetrics, setTplMetrics] = useState<TapdMetric[]>([]);

  const closeTplModal = () => { setTplOpen(false); setEditingTpl(null); tplForm.resetFields(); setTplMetrics([]); };
  const openCreateTpl = () => { setEditingTpl(null); tplForm.resetFields(); setTplMetrics([{ label: "", color: "warning", countParams: {}, timeField: null }]); setTplOpen(true); };
  const openEditTpl = (t: TapdReportTemplate) => { setEditingTpl(t); tplForm.setFieldsValue({ name: t.name, description: t.description }); setTplMetrics([...t.metrics]); setTplOpen(true); };
  const duplicateTpl = (t: TapdReportTemplate) => { setEditingTpl(null); tplForm.resetFields(); tplForm.setFieldsValue({ name: t.name + "（副本）", description: t.description }); setTplMetrics([...t.metrics]); setTplOpen(true); };

  const createTplMut = useMutation(tapdBugApi.templates.create, { onSuccess: () => { qc.invalidateQueries("tapd-bug-templates"); message.success("已创建"); closeTplModal(); }, onError: (e: { response?: { data?: { detail?: string } } }) => { message.error(e.response?.data?.detail ?? "失败"); } });
  const updateTplMut = useMutation(({ id, body }: { id: string; body: Partial<TapdReportTemplate> }) => tapdBugApi.templates.update(id, body), { onSuccess: () => { qc.invalidateQueries("tapd-bug-templates"); message.success("已保存"); closeTplModal(); }, onError: (e: { response?: { data?: { detail?: string } } }) => { message.error(e.response?.data?.detail ?? "失败"); } });
  const deleteTplMut = useMutation(tapdBugApi.templates.delete, { onSuccess: () => { qc.invalidateQueries("tapd-bug-templates"); message.success("已删除"); } });

  const handleTplSubmit = (v: Record<string, unknown>) => {
    const valid = tplMetrics.filter(m => m.label.trim());
    if (!valid.length) { message.error("至少需要一个有名称的指标"); return; }
    const payload = { name: v.name as string, description: (v.description as string) || "", metrics: valid };
    if (editingTpl) updateTplMut.mutate({ id: editingTpl.id, body: payload });
    else createTplMut.mutate(payload);
  };

  // ── 配置弹窗 ──
  const [cfgOpen, setCfgOpen] = useState(false);
  const [editingCfg, setEditingCfg] = useState<TapdBugReportConfig | null>(null);
  const [cfgForm] = Form.useForm();
  const [freq, setFreq] = useState<Frequency>("workday");
  const [hour, setHour] = useState(18); const [minute, setMinute] = useState(0);
  const [weekday, setWeekday] = useState(1); const [monthday, setMonthday] = useState(1);
  const resetSched = () => { setFreq("workday"); setHour(18); setMinute(0); setWeekday(1); setMonthday(1); };
  const closeCfgModal = useCallback(() => { setCfgOpen(false); setEditingCfg(null); cfgForm.resetFields(); resetSched(); }, [cfgForm]);

  const openCreateCfg = () => { setEditingCfg(null); cfgForm.resetFields(); resetSched(); setCfgOpen(true); };
  const openEditCfg = (r: TapdBugReportConfig) => {
    setEditingCfg(r); const p = parseCron(r.cronExpression);
    setFreq(p.freq); setHour(p.hour); setMinute(p.minute); setWeekday(p.weekday); setMonthday(p.monthday);
    cfgForm.setFieldsValue({
      name: r.name, webhookUrl: r.webhookUrl, templateId: r.templateId || undefined,
    });
    setCfgOpen(true);
  };

  const createCfgMut = useMutation(tapdBugApi.configs.create, { onSuccess: () => { qc.invalidateQueries("tapd-bug-configs"); message.success("已创建"); closeCfgModal(); }, onError: (e: { response?: { data?: { detail?: string } } }) => { message.error(e.response?.data?.detail ?? "失败"); } });
  const updateCfgMut = useMutation(({ id, body }: { id: string; body: Partial<TapdBugReportConfig> }) => tapdBugApi.configs.update(id, body), { onSuccess: () => { qc.invalidateQueries("tapd-bug-configs"); message.success("已保存"); closeCfgModal(); }, onError: (e: { response?: { data?: { detail?: string } } }) => { message.error(e.response?.data?.detail ?? "失败"); } });
  const deleteCfgMut = useMutation(tapdBugApi.configs.delete, { onSuccess: () => { qc.invalidateQueries("tapd-bug-configs"); message.success("已删除"); } });
  const sendMut = useMutation(tapdBugApi.configs.send, { onSuccess: (res: { success: boolean }) => { res.success ? message.success("发送成功") : message.warning("发送失败"); }, onError: (e: { response?: { data?: { detail?: string } } }) => { message.error(e.response?.data?.detail ?? "失败"); } });

  const handleToggleEnabled = (r: TapdBugReportConfig, checked: boolean) => updateCfgMut.mutate({ id: r.id, body: { enabled: checked } as Partial<TapdBugReportConfig> });

  const handleCfgSubmit = (v: Record<string, unknown>) => {
    const cron = buildCron(freq, hour, minute, weekday, monthday);
    const payload = { name: v.name as string, webhookUrl: v.webhookUrl as string, templateId: (v.templateId as string) || null, cronExpression: cron };
    if (editingCfg) updateCfgMut.mutate({ id: editingCfg.id, body: payload as Partial<TapdBugReportConfig> });
    else createCfgMut.mutate(payload as Partial<TapdBugReportConfig>);
  };

  // ── 预览 ──
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<{ configured: boolean; results?: { label: string; value: number | null; color: string }[]; message?: string; filters?: TapdBugFilters } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const handlePreview = async (r: TapdBugReportConfig) => {
    setPreviewLoading(true);
    try {
      const res = await tapdBugApi.preview({ filters: r.filters, templateId: r.templateId || undefined });
      setPreviewData(res); setPreviewOpen(true);
    } catch { message.error("预览失败"); } finally { setPreviewLoading(false); }
  };

  const tplNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    templates.forEach(t => { m[t.id] = t.name; });
    return m;
  }, [templates]);

  return (<div>
    <Typography.Title level={4} className="page-title">TAPD 缺陷管理</Typography.Title>
    <p className="page-desc">配置缺陷日报模板和定时推送任务。</p>

    {/* ═══ 模板管理 ═══ */}
    <Collapse defaultActiveKey={["templates"]} style={{ marginBottom: 20 }} items={[{
      key: "templates",
      label: <Typography.Text strong>报表模板</Typography.Text>,
      extra: <Button type="primary" size="small" icon={<PlusOutlined />} onClick={e => { e.stopPropagation(); openCreateTpl(); }}>新建模板</Button>,
      children: (
        <Table rowKey="id" loading={templatesLoading} dataSource={templates} pagination={false} size="small" columns={[
          { title: "名称", dataIndex: "name", width: 160, render: (v: string, r: TapdReportTemplate) => <>{v} {r.builtIn && <Tag color="blue" style={{ fontSize: 10 }}>内置</Tag>}</> },
          { title: "描述", dataIndex: "description", ellipsis: true },
          { title: "指标数", width: 80, render: (_: unknown, r: TapdReportTemplate) => r.metrics.length },
          { title: "指标", render: (_: unknown, r: TapdReportTemplate) => <Space size={4} wrap>{r.metrics.map((m, i) => <Tag key={i} style={{ fontSize: 11, margin: 0 }}>{m.label}</Tag>)}</Space> },
          { title: "操作", width: 180, render: (_: unknown, r: TapdReportTemplate) => (
            <Space size={0}>
              <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEditTpl(r)}>{r.builtIn ? "查看" : "编辑"}</Button>
              <Button type="link" size="small" icon={<CopyOutlined />} onClick={() => duplicateTpl(r)}>复制</Button>
              {!r.builtIn && <Popconfirm title="确认删除？" onConfirm={() => deleteTplMut.mutate(r.id)}><Button type="link" danger size="small" icon={<DeleteOutlined />}>删除</Button></Popconfirm>}
            </Space>
          )},
        ]} />
      ),
    }]} />

    {/* ═══ 推送配置 ═══ */}
    <Space style={{ marginBottom: 16 }}>
      <Button type="primary" icon={<PlusOutlined />} onClick={openCreateCfg}>新建推送任务</Button>
    </Space>

    <Table rowKey="id" loading={configsLoading} dataSource={configs} pagination={false} columns={[
      { title: "名称", dataIndex: "name", width: 140 },
      { title: "模板", width: 120, render: (_: unknown, r: TapdBugReportConfig) => r.templateId ? <Tag color="blue">{tplNameMap[r.templateId] || "自定义"}</Tag> : <Tag>默认</Tag> },
      { title: "执行计划", dataIndex: "cronExpression", width: 180, render: (c: string) => <Space size={6} wrap><span>{cronReadable(c)}</span><Tag style={{ fontSize: 11 }}>{c}</Tag></Space> },
      { title: "状态", width: 80, render: (_: unknown, r: TapdBugReportConfig) => r.enabled ? <Tag color="green">启用</Tag> : <Tag>停用</Tag> },
      { title: "启用", width: 70, render: (_: unknown, r: TapdBugReportConfig) => <Switch size="small" checked={r.enabled} onChange={c => handleToggleEnabled(r, c)} /> },
      { title: "操作", width: 220, render: (_: unknown, r: TapdBugReportConfig) => (
        <Space size={0} wrap>
          <Tooltip title={r.enabled ? "请先停用再编辑" : ""}><Button type="link" size="small" icon={<EditOutlined />} disabled={r.enabled} onClick={() => openEditCfg(r)}>编辑</Button></Tooltip>
          <Button type="link" size="small" icon={<EyeOutlined />} loading={previewLoading} onClick={() => handlePreview(r)}>预览</Button>
          <Popconfirm title="确认立即发送？" onConfirm={() => sendMut.mutate(r.id)}><Button type="link" size="small" icon={<SendOutlined />} loading={sendMut.isLoading}>发送</Button></Popconfirm>
          <Popconfirm title="确认删除？" onConfirm={() => deleteCfgMut.mutate(r.id)}><Button type="link" danger size="small" icon={<DeleteOutlined />}>删除</Button></Popconfirm>
        </Space>
      )},
    ]} />

    {/* ═══ 模板弹窗 ═══ */}
    <Modal title={editingTpl ? (editingTpl.builtIn ? "查看内置模板" : "编辑模板") : "新建模板"} open={tplOpen} onCancel={closeTplModal} onOk={() => tplForm.submit()} confirmLoading={createTplMut.isLoading || updateTplMut.isLoading} destroyOnClose width={640}>
      <Form form={tplForm} layout="vertical" onFinish={handleTplSubmit}>
        <Form.Item name="name" label="模板名称" rules={[{ required: true }]}><Input placeholder="如：核心 Bug 日报" /></Form.Item>
        <Form.Item name="description" label="描述"><Input placeholder="简单说明模板用途" /></Form.Item>
        <Divider style={{ margin: "12px 0" }} />
        <Typography.Text strong style={{ display: "block", marginBottom: 8 }}>统计指标</Typography.Text>
        <MetricEditor metrics={tplMetrics} onChange={setTplMetrics} />
      </Form>
    </Modal>

    {/* ═══ 配置弹窗 ═══ */}
    <Modal title={editingCfg ? "编辑推送任务" : "新建推送任务"} open={cfgOpen} onCancel={closeCfgModal} onOk={() => cfgForm.submit()} confirmLoading={createCfgMut.isLoading || updateCfgMut.isLoading} destroyOnClose width={600}>
      <Form form={cfgForm} layout="vertical" onFinish={handleCfgSubmit}>
        <Form.Item name="name" label="任务名称" rules={[{ required: true }]}><Input placeholder="如：AI理财缺陷日报" /></Form.Item>
        <Form.Item name="webhookUrl" label="企业微信 Webhook URL" rules={[{ required: true }]}><Input placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..." /></Form.Item>
        <Form.Item name="templateId" label="报表模板" extra="选择模板决定统计哪些指标；不选则用默认模板（剩余+新增+关闭）">
          <Select allowClear placeholder="选择模板（可不选，用默认）" options={templates.map(t => ({ label: `${t.name}${t.builtIn ? "（内置）" : ""}`, value: t.id }))} />
        </Form.Item>

        <Divider style={{ margin: "12px 0" }} />
        <Typography.Text strong style={{ display: "block", marginBottom: 12, fontSize: 13 }}>定时发送设置</Typography.Text>
        <Form.Item label="执行频率" required>
          <Space wrap size={[12, 8]}><Select value={freq} onChange={setFreq} options={FREQ_OPTIONS} style={{ width: 200 }} />
            {freq === "weekly" && <Select value={weekday} onChange={setWeekday} options={WEEKDAY_OPTIONS} style={{ width: 100 }} />}
            {freq === "monthly" && <Select value={monthday} onChange={setMonthday} options={MONTHDAY_OPTIONS} style={{ width: 100 }} />}
          </Space>
        </Form.Item>
        <Form.Item label="执行时间" required>
          <Space size={8}><Select value={hour} onChange={setHour} options={HOUR_OPTIONS} style={{ width: 100 }} showSearch optionFilterProp="label" />
            <Select value={minute} onChange={setMinute} options={MINUTE_OPTIONS} style={{ width: 100 }} showSearch optionFilterProp="label" /></Space>
        </Form.Item>
        <CronPreview freq={freq} hour={hour} minute={minute} weekday={weekday} monthday={monthday} />
      </Form>
    </Modal>

    {/* ═══ 预览弹窗 ═══ */}
    <Modal title="缺陷日报预览" open={previewOpen} onCancel={() => setPreviewOpen(false)} footer={null} width={480}>
      {previewData && (<div>
        {!previewData.configured ? <Typography.Text type="warning">{previewData.message}</Typography.Text> : (<div>
          {previewData.filters && filtersToTags(previewData.filters).length > 0 && <div style={{ marginBottom: 12 }}>
            <Typography.Text type="secondary">筛选条件：</Typography.Text>{" "}{filtersToTags(previewData.filters).map((t, i) => <Tag key={i} color="blue" style={{ fontSize: 11 }}>{t}</Tag>)}
          </div>}
          {previewData.results?.map((item, i) => <p key={i}>{item.label}：<Typography.Text strong>{item.value ?? "N/A"}</Typography.Text></p>)}
        </div>)}
      </div>)}
    </Modal>
  </div>);
}
