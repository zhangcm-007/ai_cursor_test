import { useQuery, useMutation, useQueryClient } from "react-query";
import { Button, Table, Space, Select, Modal, Form, Input, Typography, message, Checkbox, Spin } from "antd";
import { Link } from "react-router-dom";
import { PlusOutlined, EditOutlined, DeleteOutlined, ThunderboltOutlined, ExportOutlined } from "@ant-design/icons";
import { useState, useEffect, useRef } from "react";
import { testPointsApi } from "../api/test-points";
import { requirementsApi } from "../api/requirements";
import { generateApi, type TestPointsJobState } from "../api/generate";
import { exportApi } from "../api/export";
import type { TestPoint } from "../api/client";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function TestPointList() {
  const [requirementFilter, setRequirementFilter] = useState<string | undefined>();
  const [modalOpen, setModalOpen] = useState(false);
  const [genModalOpen, setGenModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [editing, setEditing] = useState<TestPoint | null>(null);
  const [includeHistory, setIncludeHistory] = useState(false);
  const [historyCount, setHistoryCount] = useState(5);
  const [form] = Form.useForm();
  const [genForm] = Form.useForm();
  const [exportForm] = Form.useForm();
  const [exportLoading, setExportLoading] = useState(false);
  const [genJobId, setGenJobId] = useState<string | null>(null);
  const [genJobStatus, setGenJobStatus] = useState<TestPointsJobState | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const client = useQueryClient();

  const { data: requirements = [] } = useQuery("requirements", requirementsApi.list);
  const { data: list = [], isLoading } = useQuery(
    ["test-points", requirementFilter],
    () => testPointsApi.list(requirementFilter),
    { enabled: true }
  );
  const create = useMutation(testPointsApi.create, {
    onSuccess: () => {
      client.invalidateQueries("test-points");
      client.invalidateQueries("requirements");
      setModalOpen(false);
      form.resetFields();
      message.success("创建成功");
    },
    onError: (e: { response?: { data?: { error?: string } } }) =>
      message.error(e.response?.data?.error ?? "创建失败"),
  });
  const update = useMutation(
    (p: { id: string; data: { pointId?: string; description?: string; type?: string } }) =>
      testPointsApi.update(p.id, p.data),
    {
      onSuccess: () => {
        client.invalidateQueries("test-points");
        setModalOpen(false);
        setEditing(null);
        form.resetFields();
        message.success("更新成功");
      },
      onError: (e: { response?: { data?: { error?: string } } }) =>
        message.error(e.response?.data?.error ?? "更新失败"),
    }
  );
  const remove = useMutation(testPointsApi.delete, {
    onSuccess: () => {
      client.invalidateQueries("test-points");
      client.invalidateQueries("requirements");
      message.success("已删除");
    },
    onError: (e: { response?: { data?: { error?: string } } }) =>
      message.error(e.response?.data?.error ?? "删除失败"),
  });
  const batchRemove = useMutation(
    (ids: string[]) => testPointsApi.batchDelete(ids),
    {
      onSuccess: (data) => {
        client.invalidateQueries("test-points");
        client.invalidateQueries("requirements");
        setSelectedRowKeys([]);
        message.success(`已批量删除 ${data.deleted} 条`);
      },
      onError: (e: { response?: { data?: { error?: string } } }) =>
        message.error(e.response?.data?.error ?? "批量删除失败"),
    }
  );
  const genPointsStart = useMutation(
    (requirementId: string) =>
      generateApi.testPointsStart({ requirementId, includeHistory, historyCount }),
    {
      onSuccess: (data) => {
        setGenJobId(data.jobId);
        setGenJobStatus({ status: "pending" });
        setTimeout(() => {
          setGenModalOpen(false);
          genForm.resetFields();
        }, 3000);
      },
      onError: (e: { response?: { data?: { error?: string } } }) =>
        message.error(e.response?.data?.error ?? "提交失败"),
    }
  );

  useEffect(() => {
    if (!genJobId) return;
    const poll = () => {
      generateApi.testPointsStatus(genJobId!).then((next) => {
        setGenJobStatus(next);
        if (next.status === "completed") {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          client.invalidateQueries("test-points");
          client.invalidateQueries("requirements");
          message.success(`已根据需求内容与历史需求生成 ${next.result?.created ?? 0} 个测试点`);
          if (next.result?.attachmentErrors?.length)
            message.warning(`部分附件未解析: ${next.result.attachmentErrors.join(", ")}`);
        } else if (next.status === "failed") {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          message.error(next.error ?? "生成失败");
        }
      }).catch(() => {});
    };
    poll();
    pollRef.current = setInterval(poll, 10000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [genJobId, client]);

  const handleSubmit = () => {
    form.validateFields().then((v) => {
      if (editing) {
        update.mutate({
          id: editing.id,
          data: { pointId: v.pointId, description: v.description, type: v.type },
        });
      } else {
        if (!v.requirementId) {
          message.error("请选择需求");
          return;
        }
        create.mutate({
          requirementId: v.requirementId,
          pointId: v.pointId,
          description: v.description,
          type: v.type,
        });
      }
    });
  };

  const handleGenSubmit = () => {
    genForm.validateFields().then((v) => {
      genPointsStart.mutate(v.requirementId);
    });
  };

  const closeGenModal = () => {
    setGenModalOpen(false);
    setGenJobId(null);
    setGenJobStatus(null);
    genForm.resetFields();
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const handleExportXmindSubmit = () => {
    exportForm.validateFields().then(async (v) => {
      const requirementId = v.requirementId as string;
      const req = requirements.find((r) => r.id === requirementId);
      const baseName = ((req?.title ?? "导出")
        .replace(/[/\\:*?"<>|]/g, "_")
        .trim() || "导出") + "+测试点";
      setExportLoading(true);
      try {
        const blob = await exportApi.xmindTestPoints({
          requirementIds: [requirementId],
          format: "mm",
        });
        downloadBlob(blob, `${baseName}.mm`);
        message.success("导出成功");
        setExportModalOpen(false);
        exportForm.resetFields();
      } catch (e) {
        message.error("导出失败");
      } finally {
        setExportLoading(false);
      }
    });
  };

  return (
    <div>
      <Typography.Title level={4}>测试点列表</Typography.Title>
      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          placeholder="按需求筛选"
          allowClear
          style={{ width: 220 }}
          value={requirementFilter}
          onChange={setRequirementFilter}
          options={requirements.map((r) => ({ label: r.title, value: r.id }))}
        />
        <Button
          type="primary"
          icon={<ThunderboltOutlined />}
          onClick={() => {
            genForm.setFieldsValue({ requirementId: requirementFilter });
            setGenModalOpen(true);
          }}
        >
          根据需求生成测试点
        </Button>
        <Button
          icon={<PlusOutlined />}
          onClick={() => {
            setEditing(null);
            form.resetFields();
            form.setFieldsValue({ requirementId: requirementFilter });
            setModalOpen(true);
          }}
        >
          新建测试点
        </Button>
        <Button
          icon={<ExportOutlined />}
          onClick={() => {
            exportForm.setFieldsValue({ requirementId: requirementFilter });
            setExportModalOpen(true);
          }}
        >
          导出 XMind
        </Button>
        <Button
          danger
          icon={<DeleteOutlined />}
          disabled={selectedRowKeys.length === 0}
          onClick={() => {
            if (confirm(`确定删除选中的 ${selectedRowKeys.length} 条测试点？`))
              batchRemove.mutate(selectedRowKeys as string[]);
          }}
        >
          批量删除{selectedRowKeys.length > 0 ? ` (${selectedRowKeys.length})` : ""}
        </Button>
      </Space>
      <Table
        loading={isLoading}
        rowKey="id"
        dataSource={list}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys),
        }}
        columns={[
          {
            title: "需求",
            dataIndex: ["requirement", "title"],
            width: 160,
            render: (t, r) =>
              r.requirement ? (
                <Link to={`/requirements/${r.requirement.id}`}>{t}</Link>
              ) : (
                "-"
              ),
          },
          { title: "测试点ID", dataIndex: "pointId", width: 100 },
          { title: "描述", dataIndex: "description", ellipsis: true },
          { title: "类型", dataIndex: "type", width: 80 },
          { title: "用例数", dataIndex: ["_count", "testCases"], width: 80 },
          {
            title: "更新时间",
            dataIndex: "updatedAt",
            width: 160,
            render: (t: string) => (t ? new Date(t).toLocaleString("zh-CN") : "-"),
          },
          {
            title: "操作",
            width: 140,
            render: (_, r) => (
              <Space>
                <Link to={`/test-points/${r.id}`}>详情</Link>
                <Button
                  type="link"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => {
                    setEditing(r);
                    form.setFieldsValue({
                      pointId: r.pointId,
                      description: r.description,
                      type: r.type,
                    });
                    setModalOpen(true);
                  }}
                />
                <Button
                  type="link"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => {
                    if (confirm("确定删除？")) remove.mutate(r.id);
                  }}
                />
              </Space>
            ),
          },
        ]}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          showSizeChanger: true,
          pageSizeOptions: ["10", "20", "50"],
          showTotal: (total) => `共 ${total} 条`,
          onChange: (page, pageSize) => {
            setPagination((p) => ({ ...p, current: page, pageSize: pageSize || p.pageSize }));
          },
        }}
      />
      <Modal
        title={editing ? "编辑测试点" : "新建测试点"}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        okText="确定"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          {!editing && (
            <Form.Item name="requirementId" label="所属需求" rules={[{ required: true }]}>
              <Select
                placeholder="选择需求"
                options={requirements.map((r) => ({ label: r.title, value: r.id }))}
              />
            </Form.Item>
          )}
          <Form.Item name="pointId" label="测试点ID" rules={[{ required: true }]}>
            <Input placeholder="如 TP-01" />
          </Form.Item>
          <Form.Item name="description" label="描述" rules={[{ required: true }]}>
            <Input.TextArea rows={2} placeholder="测试点描述" />
          </Form.Item>
          <Form.Item name="type" label="类型" initialValue="功能">
            <Select
              placeholder="请选择类型"
              options={[
                { value: "功能", label: "功能" },
                { value: "边界", label: "边界" },
                { value: "异常", label: "异常" },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title="根据需求生成测试点"
        open={genModalOpen}
        onOk={genJobStatus?.status === "completed" || genJobStatus?.status === "failed" ? closeGenModal : handleGenSubmit}
        onCancel={closeGenModal}
        okText={genJobStatus?.status === "completed" || genJobStatus?.status === "failed" ? "确定" : "生成"}
        cancelText="取消"
        confirmLoading={genPointsStart.isLoading}
        maskClosable={!(genJobStatus?.status === "pending" || genJobStatus?.status === "running")}
      >
        <p style={{ color: "#666", marginBottom: 16 }}>
          将根据所选需求的标题、正文及附件解析内容，并结合历史相关需求，调用模型自动生成测试点。任务在后台运行，可查看下方运行状态。
        </p>
        {(genJobStatus?.status === "pending" || genJobStatus?.status === "running") && (
          <div style={{ marginBottom: 16, padding: 12, background: "#f5f5f5", borderRadius: 8 }}>
            <Spin size="small" style={{ marginRight: 8 }} />
            {genJobStatus.status === "pending" ? "排队中…" : "运行中…"}
          </div>
        )}
        {genJobStatus?.status === "completed" && genJobStatus.result && (
          <div style={{ marginBottom: 16, padding: 12, background: "#f6ffed", border: "1px solid #b7eb8f", borderRadius: 8 }}>
            已完成：已生成 {genJobStatus.result.created} 个测试点。
            {genJobStatus.result.attachmentErrors?.length ? ` 部分附件未解析: ${genJobStatus.result.attachmentErrors.join(", ")}` : ""}
          </div>
        )}
        {genJobStatus?.status === "failed" && (
          <div style={{ marginBottom: 16, padding: 12, background: "#fff2f0", border: "1px solid #ffccc7", borderRadius: 8 }}>
            失败：{genJobStatus.error ?? "未知错误"}
          </div>
        )}
        {(!genJobStatus || genJobStatus.status === "completed" || genJobStatus.status === "failed") && (
          <Form form={genForm} layout="vertical">
            <Form.Item
              name="requirementId"
              label="选择需求"
              rules={[{ required: true, message: "请选择需求" }]}
            >
              <Select
                placeholder="选择要生成测试点的需求"
                options={requirements.map((r) => ({ label: r.title, value: r.id }))}
              />
            </Form.Item>
            <Form.Item>
              <Checkbox checked={includeHistory} onChange={(e) => setIncludeHistory(e.target.checked)}>
                参考历史需求（按关键词检索未生效）
              </Checkbox>
            </Form.Item>
            {includeHistory && (
              <Form.Item label="参考条数">
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={historyCount}
                  onChange={(e) => setHistoryCount(Number(e.target.value) || 5)}
                  style={{ width: 80 }}
                />
              </Form.Item>
            )}
          </Form>
        )}
      </Modal>
      <Modal
        title="导出 XMind"
        open={exportModalOpen}
        onOk={handleExportXmindSubmit}
        onCancel={() => { setExportModalOpen(false); exportForm.resetFields(); }}
        okText="导出"
        cancelText="取消"
        confirmLoading={exportLoading}
      >
        <p style={{ color: "#666", marginBottom: 16 }}>
          选择需求后，将导出该需求下的测试点为 XMind 文件（.mm）。
        </p>
        <Form form={exportForm} layout="vertical">
          <Form.Item
            name="requirementId"
            label="选择需求"
            rules={[{ required: true, message: "请选择需求" }]}
          >
            <Select
              placeholder="选择要导出的需求"
              options={requirements.map((r) => ({ label: r.title, value: r.id }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
