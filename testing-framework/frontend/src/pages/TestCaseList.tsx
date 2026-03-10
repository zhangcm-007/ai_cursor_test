import { useQuery, useMutation, useQueryClient } from "react-query";
import { Button, Table, Space, Select, Modal, Form, Input, Typography, message, Checkbox } from "antd";
import { Link } from "react-router-dom";
import { PlusOutlined, EditOutlined, DeleteOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { useState } from "react";
import { testCasesApi } from "../api/test-cases";
import { requirementsApi } from "../api/requirements";
import { testPointsApi } from "../api/test-points";
import { generateApi } from "../api/generate";
import type { TestCase } from "../api/client";

export default function TestCaseList() {
  const [requirementFilter, setRequirementFilter] = useState<string | undefined>();
  const [priorityFilter, setPriorityFilter] = useState<string | undefined>();
  const [modalOpen, setModalOpen] = useState(false);
  const [genModalOpen, setGenModalOpen] = useState(false);
  const [editing, setEditing] = useState<TestCase | null>(null);
  const [includeHistory, setIncludeHistory] = useState(true);
  const [historyCount, setHistoryCount] = useState(5);
  const [form] = Form.useForm();
  const [genForm] = Form.useForm();
  const client = useQueryClient();

  const { data: requirements = [] } = useQuery("requirements", requirementsApi.list);
  const { data: points = [] } = useQuery(
    "test-points",
    () => testPointsApi.list(undefined),
    { enabled: true }
  );
  const { data: list = [], isLoading } = useQuery(
    ["test-cases", requirementFilter, priorityFilter],
    () => testCasesApi.list({ requirementId: requirementFilter, priority: priorityFilter }),
    { enabled: true }
  );
  const create = useMutation(testCasesApi.create, {
    onSuccess: () => {
      client.invalidateQueries("test-cases");
      setModalOpen(false);
      form.resetFields();
      message.success("创建成功");
    },
    onError: (e: { response?: { data?: { error?: string } } }) =>
      message.error(e.response?.data?.error ?? "创建失败"),
  });
  const update = useMutation(
    (p: { id: string; data: Parameters<typeof testCasesApi.update>[1] }) =>
      testCasesApi.update(p.id, p.data),
    {
      onSuccess: () => {
        client.invalidateQueries("test-cases");
        setEditing(null);
        form.resetFields();
        message.success("更新成功");
      },
      onError: (e: { response?: { data?: { error?: string } } }) =>
        message.error(e.response?.data?.error ?? "更新失败"),
    }
  );
  const remove = useMutation(testCasesApi.delete, {
    onSuccess: () => {
      client.invalidateQueries("test-cases");
      message.success("已删除");
    },
    onError: (e: { response?: { data?: { error?: string } } }) =>
      message.error(e.response?.data?.error ?? "删除失败"),
  });
  const genCases = useMutation(
    (params: {
      requirementId: string;
      includeHistory: boolean;
      historyCount: number;
    }) =>
      generateApi.testCases({
        requirementId: params.requirementId,
        includeHistory: params.includeHistory,
        historyCount: params.historyCount,
      }),
    {
      onSuccess: (data) => {
        client.invalidateQueries("test-cases");
        client.invalidateQueries("test-points");
        client.invalidateQueries("requirements");
        setGenModalOpen(false);
        genForm.resetFields();
        message.success(`已生成 ${data.created} 条测试用例`);
        if (data.attachmentErrors?.length)
          message.warning(`部分附件未解析: ${data.attachmentErrors.join(", ")}`);
      },
      onError: (e: { response?: { data?: { error?: string } } }) =>
        message.error(e.response?.data?.error ?? "生成失败"),
    }
  );

  const doGenerateCases = (requirementId: string) => {
    genCases.mutate({ requirementId, includeHistory, historyCount });
  };

  const handleGenSubmit = () => {
    genForm.validateFields().then(async (v) => {
      const requirementId = v.requirementId as string;
      const reqPoints = await testPointsApi.list(requirementId);
      if (reqPoints.length === 0) {
        Modal.confirm({
          title: "该需求暂无测试点",
          content:
            "还没生成测试点，需要直接生成测试用例吗？系统将先自动创建一个整体测试点再生成用例。",
          okText: "直接生成",
          cancelText: "取消",
          onOk: () => doGenerateCases(requirementId),
        });
      } else {
        doGenerateCases(requirementId);
      }
    });
  };

  const handleSubmit = () => {
    form.validateFields().then((v) => {
      if (editing) {
        update.mutate({
          id: editing.id,
          data: {
            caseId: v.caseId,
            title: v.title,
            priority: v.priority,
            preconditions: v.preconditions,
            steps: v.steps,
            expected: v.expected,
          },
        });
      } else {
        if (!v.testPointId) {
          message.error("请选择测试点");
          return;
        }
        create.mutate({
          testPointId: v.testPointId,
          caseId: v.caseId,
          title: v.title,
          priority: v.priority,
          preconditions: v.preconditions,
          steps: v.steps,
          expected: v.expected,
        });
      }
    });
  };

  return (
    <div>
      <Typography.Title level={4}>测试用例列表</Typography.Title>
      <Space style={{ marginBottom: 16 }}>
        <Select
          placeholder="按需求筛选"
          allowClear
          style={{ width: 200 }}
          value={requirementFilter}
          onChange={setRequirementFilter}
          options={requirements.map((r) => ({ label: r.title, value: r.id }))}
        />
        <Select
          placeholder="按优先级"
          allowClear
          style={{ width: 120 }}
          value={priorityFilter}
          onChange={setPriorityFilter}
          options={[
            { value: "P0", label: "P0" },
            { value: "P1", label: "P1" },
            { value: "P2", label: "P2" },
          ]}
        />
        <Button
          type="primary"
          icon={<ThunderboltOutlined />}
          onClick={() => {
            genForm.setFieldsValue({ requirementId: requirementFilter });
            setGenModalOpen(true);
          }}
        >
          根据需求生成测试用例
        </Button>
        <Button
          icon={<PlusOutlined />}
          onClick={() => {
            setEditing(null);
            form.resetFields();
            setModalOpen(true);
          }}
        >
          新建用例
        </Button>
      </Space>
      <Table
        loading={isLoading}
        rowKey="id"
        dataSource={list}
        columns={[
          { title: "用例ID", dataIndex: "caseId", width: 100 },
          { title: "标题", dataIndex: "title", ellipsis: true },
          { title: "优先级", dataIndex: "priority", width: 80 },
          { title: "测试点", dataIndex: ["testPoint", "pointId"], width: 100 },
          {
            title: "操作",
            width: 140,
            render: (_, r) => (
              <Space>
                <Link to={`/test-cases/${r.id}`}>详情</Link>
                <Button
                  type="link"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => {
                    setEditing(r);
                    form.setFieldsValue({
                      testPointId: r.testPointId,
                      caseId: r.caseId,
                      title: r.title,
                      priority: r.priority,
                      preconditions: r.preconditions,
                      steps: r.steps,
                      expected: r.expected,
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
        title={editing ? "编辑用例" : "新建用例"}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        okText="确定"
        cancelText="取消"
        width={560}
      >
        <Form form={form} layout="vertical">
          {!editing && (
            <Form.Item name="testPointId" label="所属测试点" rules={[{ required: true }]}>
              <Select
                placeholder="选择测试点"
                options={points.map((p) => ({
                  label: `${p.pointId} - ${(p as { requirement?: { title: string } }).requirement?.title ?? ""}`,
                  value: p.id,
                }))}
              />
            </Form.Item>
          )}
          <Form.Item name="caseId" label="用例编号" rules={[{ required: true }]}>
            <Input placeholder="如 TC-001" />
          </Form.Item>
          <Form.Item name="title" label="标题" rules={[{ required: true }]}>
            <Input placeholder="用例标题" />
          </Form.Item>
          <Form.Item name="priority" label="优先级" initialValue="P1">
            <Select
              options={[
                { value: "P0", label: "P0" },
                { value: "P1", label: "P1" },
                { value: "P2", label: "P2" },
              ]}
            />
          </Form.Item>
          <Form.Item name="preconditions" label="前置条件">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="steps" label="测试步骤">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="expected" label="预期结果">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title="根据需求生成测试用例"
        open={genModalOpen}
        onOk={handleGenSubmit}
        onCancel={() => setGenModalOpen(false)}
        okText="生成"
        cancelText="取消"
        confirmLoading={genCases.isLoading}
      >
        <p style={{ color: "#666", marginBottom: 16 }}>
          将根据所选需求下的测试点（及需求内容、历史相关需求）调用模型生成测试用例。若该需求尚无测试点，可选择直接生成，系统会先自动创建整体测试点再生成用例。
        </p>
        <Form form={genForm} layout="vertical">
          <Form.Item
            name="requirementId"
            label="选择需求"
            rules={[{ required: true, message: "请选择需求" }]}
          >
            <Select
              placeholder="选择要生成测试用例的需求"
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
