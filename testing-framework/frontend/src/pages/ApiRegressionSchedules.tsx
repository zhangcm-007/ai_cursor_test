import { useQuery, useMutation, useQueryClient } from "react-query";
import { Button, Form, Input, Modal, Popconfirm, Select, Space, Switch, Table, Tag, Tooltip, Typography, message } from "antd";
import { PlusOutlined, DeleteOutlined, EditOutlined, ClockCircleOutlined } from "@ant-design/icons";
import { useState, useMemo, useCallback } from "react";
import { CronExpressionParser } from "cron-parser";
import { apiRegressionApi, type ApiScheduleRow } from "../api/api-regression";

type Frequency = "daily" | "workday" | "weekly" | "monthly";

const FREQ_OPTIONS: { label: string; value: Frequency }[] = [
  { label: "每天", value: "daily" },
  { label: "工作日（周一至周五）", value: "workday" },
  { label: "每周", value: "weekly" },
  { label: "每月", value: "monthly" },
];

const WEEKDAY_OPTIONS = [
  { label: "周一", value: 1 },
  { label: "周二", value: 2 },
  { label: "周三", value: 3 },
  { label: "周四", value: 4 },
  { label: "周五", value: 5 },
  { label: "周六", value: 6 },
  { label: "周日", value: 0 },
];

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
  label: `${String(i).padStart(2, "0")} 时`,
  value: i,
}));

const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => ({
  label: `${String(i).padStart(2, "0")} 分`,
  value: i,
}));

const MONTHDAY_OPTIONS = Array.from({ length: 31 }, (_, i) => ({
  label: `${i + 1} 日`,
  value: i + 1,
}));

function buildCronExpression(freq: Frequency, hour: number, minute: number, weekday?: number, monthday?: number): string {
  switch (freq) {
    case "daily":
      return `${minute} ${hour} * * *`;
    case "workday":
      return `${minute} ${hour} * * 1-5`;
    case "weekly":
      return `${minute} ${hour} * * ${weekday ?? 1}`;
    case "monthly":
      return `${minute} ${hour} ${monthday ?? 1} * *`;
  }
}

function parseCronToFields(cron: string): { freq: Frequency; hour: number; minute: number; weekday: number; monthday: number } {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return { freq: "daily", hour: 9, minute: 0, weekday: 1, monthday: 1 };
  const [m, h, dom, , dow] = parts;
  const hour = parseInt(h, 10) || 0;
  const minute = parseInt(m, 10) || 0;

  if (dow === "1-5") return { freq: "workday", hour, minute, weekday: 1, monthday: 1 };
  if (dom !== "*") return { freq: "monthly", hour, minute, weekday: 1, monthday: parseInt(dom, 10) || 1 };
  if (dow !== "*") return { freq: "weekly", hour, minute, weekday: parseInt(dow, 10) || 1, monthday: 1 };
  return { freq: "daily", hour, minute, weekday: 1, monthday: 1 };
}

function describeCron(freq: Frequency, hour: number, minute: number, weekday?: number, monthday?: number, skipHoliday?: boolean): string {
  const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  let desc: string;
  switch (freq) {
    case "daily":
      desc = `每天 ${time}`;
      break;
    case "workday":
      desc = `工作日 ${time}`;
      break;
    case "weekly": {
      const dayName = WEEKDAY_OPTIONS.find((w) => w.value === weekday)?.label ?? "周一";
      desc = `每${dayName} ${time}`;
      break;
    }
    case "monthly":
      desc = `每月 ${monthday ?? 1} 日 ${time}`;
      break;
  }
  if (skipHoliday) desc += "（跳过节假日）";
  return desc;
}

function getNextTimes(cronExpr: string, count = 5): string[] {
  try {
    return CronExpressionParser.parse(cronExpr)
      .take(count)
      .map((d) =>
        d.toDate().toLocaleString("zh-CN", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }),
      );
  } catch {
    return [];
  }
}

function cronToReadable(cron: string): string {
  const parts = cron.split(/\s+/);
  if (parts.length !== 5) return cron;
  const [m, h, dom, , dow] = parts;
  const time = `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
  if (dow === "1-5") return `工作日 ${time}`;
  if (dom !== "*") return `每月${dom}日 ${time}`;
  if (dow !== "*") {
    const name = WEEKDAY_OPTIONS.find((w) => String(w.value) === dow)?.label ?? `周${dow}`;
    return `每${name} ${time}`;
  }
  return `每天 ${time}`;
}

function ScheduleConfigPreview({
  freq, hour, minute, weekday, monthday, skipHoliday,
}: {
  freq: Frequency; hour: number; minute: number; weekday?: number; monthday?: number; skipHoliday?: boolean;
}) {
  const cronExpr = buildCronExpression(freq, hour, minute, weekday, monthday);
  const desc = describeCron(freq, hour, minute, weekday, monthday, skipHoliday);
  const times = useMemo(() => getNextTimes(cronExpr), [cronExpr]);

  return (
    <div style={{ padding: "10px 0" }}>
      <Space size={4} align="center" style={{ marginBottom: 6 }}>
        <ClockCircleOutlined style={{ color: "#1677ff" }} />
        <Typography.Text strong style={{ fontSize: 13 }}>{desc}</Typography.Text>
        <Tag style={{ fontSize: 11, margin: 0 }}>{cronExpr}</Tag>
      </Space>
      {times.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>
            接下来 {times.length} 次执行时间：
          </Typography.Text>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {times.map((t, i) => (
              <Tag key={i} style={{ fontSize: 12, margin: 0, width: "fit-content" }} color={i === 0 ? "blue" : undefined}>
                {t}
              </Tag>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ApiRegressionSchedules() {
  const [open, setOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ApiScheduleRow | null>(null);
  const [form] = Form.useForm();
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery<ApiScheduleRow[]>("api-schedules", apiRegressionApi.schedules.list);
  const { data: envs = [] } = useQuery("api-envs", apiRegressionApi.environments.list);
  const { data: cols = [] } = useQuery("api-collections", apiRegressionApi.collections.list);

  const [freq, setFreq] = useState<Frequency>("daily");
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);
  const [weekday, setWeekday] = useState(1);
  const [monthday, setMonthday] = useState(1);
  const [skipHoliday, setSkipHoliday] = useState(false);

  const resetScheduleFields = () => {
    setFreq("daily");
    setHour(9);
    setMinute(0);
    setWeekday(1);
    setMonthday(1);
    setSkipHoliday(false);
  };

  const isEditing = editingSchedule !== null;
  const modalTitle = isEditing ? "编辑定时任务" : "新建定时任务";

  const openCreateModal = useCallback(() => {
    setEditingSchedule(null);
    form.resetFields();
    resetScheduleFields();
    setOpen(true);
  }, [form]);

  const openEditModal = useCallback((row: ApiScheduleRow) => {
    setEditingSchedule(row);
    const parsed = parseCronToFields(row.cronExpression);
    setFreq(parsed.freq);
    setHour(parsed.hour);
    setMinute(parsed.minute);
    setWeekday(parsed.weekday);
    setMonthday(parsed.monthday);
    setSkipHoliday(row.skipHoliday ?? false);
    form.setFieldsValue({
      name: row.name,
      environmentId: row.environmentId,
      collectionId: row.collectionId,
      regressionMode: row.regressionMode,
    });
    setOpen(true);
  }, [form]);

  const closeModal = useCallback(() => {
    setOpen(false);
    setEditingSchedule(null);
    resetScheduleFields();
  }, []);

  const create = useMutation(apiRegressionApi.schedules.create, {
    onSuccess: () => {
      qc.invalidateQueries("api-schedules");
      message.success("已创建");
      closeModal();
      form.resetFields();
    },
    onError: (e: { response?: { data?: { detail?: string } } }) => {
      message.error(e.response?.data?.detail ?? "失败");
    },
  });

  const updateMut = useMutation(
    ({ id, body }: { id: string; body: Partial<Omit<ApiScheduleRow, "id">> }) =>
      apiRegressionApi.schedules.update(id, body),
    {
      onSuccess: () => {
        qc.invalidateQueries("api-schedules");
        message.success("已更新");
        closeModal();
      },
      onError: (e: { response?: { data?: { detail?: string } } }) => {
        message.error(e.response?.data?.detail ?? "更新失败");
      },
    },
  );

  const remove = useMutation(apiRegressionApi.schedules.delete, {
    onSuccess: () => {
      qc.invalidateQueries("api-schedules");
      message.success("已删除");
    },
  });

  const handleToggleEnabled = useCallback((row: ApiScheduleRow, checked: boolean) => {
    updateMut.mutate({ id: row.id, body: { enabled: checked } });
  }, [updateMut]);

  const handleSubmit = (formValues: Record<string, unknown>) => {
    const cronExpression = buildCronExpression(freq, hour, minute, weekday, monthday);
    const payload = {
      name: formValues.name as string,
      environmentId: formValues.environmentId as string,
      collectionId: formValues.collectionId as string,
      regressionMode: (formValues.regressionMode as string) || "full",
      cronExpression,
      skipHoliday,
    };

    if (isEditing) {
      updateMut.mutate({ id: editingSchedule.id, body: payload });
    } else {
      create.mutate(payload);
    }
  };

  return (
    <div>
      <Typography.Title level={4} className="page-title">
        接口测试 · 定时任务
      </Typography.Title>
      <p className="page-desc">配置定时执行的回归测试任务。重启进程后重新加载。</p>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
          新建定时
        </Button>
      </Space>
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={data}
        columns={[
          { title: "名称", dataIndex: "name" },
          {
            title: "状态",
            dataIndex: "enabled",
            width: 90,
            render: (enabled: boolean) =>
              enabled ? <Tag color="green">运行中</Tag> : <Tag>已停用</Tag>,
          },
          {
            title: "启用",
            dataIndex: "enabled",
            width: 80,
            render: (enabled: boolean, r: ApiScheduleRow) => (
              <Switch
                size="small"
                checked={enabled}
                loading={updateMut.isLoading}
                onChange={(checked) => handleToggleEnabled(r, checked)}
              />
            ),
          },
          {
            title: "执行计划",
            dataIndex: "cronExpression",
            render: (cron: string, r: ApiScheduleRow) => (
              <Space size={6} wrap>
                <span>{cronToReadable(cron)}</span>
                <Tag style={{ fontSize: 11 }}>{cron}</Tag>
                {r.skipHoliday && <Tag color="orange" style={{ fontSize: 11, margin: 0 }}>跳过节假日</Tag>}
              </Space>
            ),
          },
          { title: "模式", dataIndex: "regressionMode", width: 90 },
          {
            title: "操作",
            width: 140,
            render: (_, r: ApiScheduleRow) => (
              <Space size={4}>
                {r.enabled ? (
                  <Tooltip title="请先关闭任务再编辑">
                    <Button type="link" size="small" icon={<EditOutlined />} disabled>
                      编辑
                    </Button>
                  </Tooltip>
                ) : (
                  <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEditModal(r)}>
                    编辑
                  </Button>
                )}
                <Popconfirm title="确认删除该定时任务？" onConfirm={() => remove.mutate(r.id)} okText="删除" cancelText="取消">
                  <Button type="link" danger size="small" icon={<DeleteOutlined />}>
                    删除
                  </Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={modalTitle}
        open={open}
        onCancel={closeModal}
        onOk={() => form.submit()}
        confirmLoading={create.isLoading || updateMut.isLoading}
        width={560}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ regressionMode: "full" }}
          onFinish={handleSubmit}
        >
          <Form.Item name="name" label="名称" rules={[{ required: true, message: "请输入任务名称" }]}>
            <Input placeholder="例：每日回归测试" />
          </Form.Item>

          <Form.Item label="执行频率" required>
            <Space wrap size={[12, 8]} align="start">
              <Select
                value={freq}
                onChange={setFreq}
                options={FREQ_OPTIONS}
                style={{ width: 200 }}
              />
              {freq === "weekly" && (
                <Select
                  value={weekday}
                  onChange={setWeekday}
                  options={WEEKDAY_OPTIONS}
                  style={{ width: 100 }}
                />
              )}
              {freq === "monthly" && (
                <Select
                  value={monthday}
                  onChange={setMonthday}
                  options={MONTHDAY_OPTIONS}
                  style={{ width: 100 }}
                />
              )}
            </Space>
          </Form.Item>

          <Form.Item label="执行时间" required>
            <Space size={8}>
              <Select
                value={hour}
                onChange={setHour}
                options={HOUR_OPTIONS}
                style={{ width: 100 }}
                showSearch
                optionFilterProp="label"
              />
              <Select
                value={minute}
                onChange={setMinute}
                options={MINUTE_OPTIONS}
                style={{ width: 100 }}
                showSearch
                optionFilterProp="label"
              />
            </Space>
          </Form.Item>

          <Form.Item label="跳过节假日">
            <Switch checked={skipHoliday} onChange={setSkipHoliday} />
            <Typography.Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
              开启后遇到法定节假日自动跳过
            </Typography.Text>
          </Form.Item>

          <Form.Item name="environmentId" label="环境" rules={[{ required: true, message: "请选择环境" }]}>
            <Select placeholder="选择运行环境" options={envs.map((e) => ({ label: e.name, value: e.id }))} />
          </Form.Item>
          <Form.Item name="collectionId" label="集合" rules={[{ required: true, message: "请选择集合" }]}>
            <Select placeholder="选择测试集合" options={cols.map((c) => ({ label: c.name, value: c.id }))} />
          </Form.Item>
          <Form.Item name="regressionMode" label="回归模式">
            <Select
              options={[
                { label: "全量", value: "full" },
                { label: "精简", value: "subset" },
              ]}
            />
          </Form.Item>

          <ScheduleConfigPreview
            freq={freq}
            hour={hour}
            minute={minute}
            weekday={weekday}
            monthday={monthday}
            skipHoliday={skipHoliday}
          />
        </Form>
      </Modal>
    </div>
  );
}
