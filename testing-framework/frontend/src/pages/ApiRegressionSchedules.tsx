import { useQuery, useMutation, useQueryClient } from "react-query";
import { Button, Form, Input, Modal, Select, Space, Table, Typography, message } from "antd";
import { PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import { useState } from "react";
import { apiRegressionApi, type ApiScheduleRow } from "../api/api-regression";

export default function ApiRegressionSchedules() {
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery<ApiScheduleRow[]>("api-schedules", apiRegressionApi.schedules.list);
  const { data: envs = [] } = useQuery("api-envs", apiRegressionApi.environments.list);
  const { data: cols = [] } = useQuery("api-collections", apiRegressionApi.collections.list);

  const create = useMutation(apiRegressionApi.schedules.create, {
    onSuccess: () => {
      qc.invalidateQueries("api-schedules");
      message.success("已创建；请使用单 worker 运行后端以免重复触发");
      setOpen(false);
      form.resetFields();
    },
    onError: (e: { response?: { data?: { detail?: string } } }) => {
      message.error(e.response?.data?.detail ?? "失败");
    },
  });
  const remove = useMutation(apiRegressionApi.schedules.delete, {
    onSuccess: () => {
      qc.invalidateQueries("api-schedules");
      message.success("已删除");
    },
  });

  return (
    <div>
      <Typography.Title level={4} className="page-title">
        接口测试 · 定时任务
      </Typography.Title>
      <p className="page-desc">Cron 五段：分 时 日 月 周。重启进程后重新加载；多 worker 可能重复执行。</p>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
          新建定时
        </Button>
      </Space>
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={data}
        columns={[
          { title: "名称", dataIndex: "name" },
          { title: "Cron", dataIndex: "cronExpression" },
          { title: "模式", dataIndex: "regressionMode", width: 90 },
          {
            title: "操作",
            width: 90,
            render: (_, r) => (
              <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => remove.mutate(r.id)}>
                删除
              </Button>
            ),
          },
        ]}
      />
      <Modal title="新建定时任务" open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} width={520} destroyOnClose>
        <Form
          form={form}
          layout="vertical"
          initialValues={{ regressionMode: "full", enabled: true }}
          onFinish={(v) => create.mutate(v)}
        >
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="cronExpression" label="Cron（五段）" rules={[{ required: true }]} extra='例：0 9 * * * 每天 9:00'>
            <Input placeholder="0 9 * * *" />
          </Form.Item>
          <Form.Item name="environmentId" label="环境" rules={[{ required: true }]}>
            <Select options={envs.map((e) => ({ label: e.name, value: e.id }))} />
          </Form.Item>
          <Form.Item name="collectionId" label="集合" rules={[{ required: true }]}>
            <Select options={cols.map((c) => ({ label: c.name, value: c.id }))} />
          </Form.Item>
          <Form.Item name="regressionMode" label="回归模式">
            <Select
              options={[
                { label: "全量", value: "full" },
                { label: "精简", value: "subset" },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
