import { useQuery, useMutation, useQueryClient } from "react-query";
import { Button, Table, Space, Select, Modal, Form, Input, Typography, message, Checkbox } from "antd";
import { Link } from "react-router-dom";
import { PlusOutlined, EditOutlined, DeleteOutlined, ThunderboltOutlined, ExportOutlined } from "@ant-design/icons";
import { useState } from "react";
import { testPointsApi } from "../api/test-points";
import { requirementsApi } from "../api/requirements";
import { generateApi } from "../api/generate";
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
  const [editing, setEditing] = useState<TestPoint | null>(null);
  const [includeHistory, setIncludeHistory] = useState(true);
  const [historyCount, setHistoryCount] = useState(5);
  const [form] = Form.useForm();
  const [genForm] = Form.useForm();
  const [exportLoading, setExportLoading] = useState(false);
  const client = useQueryClient();

  const { data: requirements = [] } = useQuery("requirements", requirementsApi.list);
  const canExport = !!requirementFilter;
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
      message.success("已删除");
    },
    onError: (e: { response?: { data?: { error?: string } } }) =>
      message.error(e.response?.data?.error ?? "删除失败"),
  });
  const genPoints = useMutation(
    (requirementId: string) =>
      generateApi.testPoints({ requirementId, includeHistory, historyCount }),
    {
      onSuccess: (data) => {
        client.invalidateQueries("test-points");
        client.invalidateQueries("requirements");
        setGenModalOpen(false);
        genForm.resetFields();
        message.success(`已根据需求内容与历史需求生成 ${data.created} 个测试点`);
        if (data.attachmentErrors?.length)
          message.warning(`部分附件未解析: ${data.attachmentErrors.join(", ")}`);
      },
      onError: (e: { response?: { data?: { error?: string } } }) =>
        message.error(e.response?.data?.error ?? "生成失败"),
    }
  );

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
      genPoints.mutate(v.requirementId);
    });
  };

  const handleExportXmind = async () => {
    if (!requirementFilter) {
      message.warning("请先选择需求再导出");
      return;
    }
    const req = requirements.find((r) => r.id === requirementFilter);
    const baseName = (req?.title ?? "导出")
      .replace(/[/\\:*?"<>|]/g, "_")
      .trim() || "导出";
    setExportLoading(true);
    try {
      const blob = await exportApi.xmindTestPoints({
        requirementIds: [requirementFilter],
        format: "mm",
      });
      downloadBlob(blob, `${baseName}.mm`);
      message.success("导出成功");
    } catch (e) {
      message.error("导出失败");
    } finally {
      setExportLoading(false);
    }
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
          loading={exportLoading}
          onClick={handleExportXmind}
          disabled={!canExport}
        >
          导出 XMind
        </Button>
      </Space>
      {!canExport && (
        <p style={{ marginBottom: 8, color: "#999", fontSize: 12 }}>
          选择需求后可导出该需求下的测试点为 XMind 文件（.mm）。
        </p>
      )}
      <Table
        loading={isLoading}
        rowKey="id"
        dataSource={list}
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
        pagination={{ pageSize: 10 }}
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
            <Input placeholder="功能/边界/异常" />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title="根据需求生成测试点"
        open={genModalOpen}
        onOk={handleGenSubmit}
        onCancel={() => setGenModalOpen(false)}
        okText="生成"
        cancelText="取消"
        confirmLoading={genPoints.isLoading}
      >
        <p style={{ color: "#666", marginBottom: 16 }}>
          将根据所选需求的标题、正文及附件解析内容，并结合历史相关需求，调用模型自动生成测试点。
        </p>
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
              参考历史需求（按关键词检索）
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
      </Modal>
    </div>
  );
}
