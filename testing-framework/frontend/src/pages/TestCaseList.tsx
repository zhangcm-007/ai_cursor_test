import { useQuery, useMutation, useQueryClient } from "react-query";
import { Button, Table, Space, Select, Modal, Form, Input, Typography, message, Checkbox, Spin } from "antd";
import { Link } from "react-router-dom";
import { PlusOutlined, EditOutlined, DeleteOutlined, ThunderboltOutlined, ExportOutlined } from "@ant-design/icons";
import { useState, useEffect, useRef } from "react";
import { testCasesApi } from "../api/test-cases";
import { requirementsApi } from "../api/requirements";
import { generateApi } from "../api/generate";
import { exportApi } from "../api/export";
import type { TestCase } from "../api/client";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function TestCaseList() {
  const [requirementFilter, setRequirementFilter] = useState<string | undefined>();
  const [priorityFilter, setPriorityFilter] = useState<string | undefined>();
  const [modalOpen, setModalOpen] = useState(false);
  const [genModalOpen, setGenModalOpen] = useState(false);
  const [editing, setEditing] = useState<TestCase | null>(null);
  const [includeHistory, setIncludeHistory] = useState(false);
  const [historyCount, setHistoryCount] = useState(5);
  const [form] = Form.useForm();
  const [genForm] = Form.useForm();
  const [exportForm] = Form.useForm();
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const client = useQueryClient();
  const GEN_JOB_KEY = "testCasesGenJobId";

  const { data: requirements = [] } = useQuery("requirements", requirementsApi.list);
  const [genCasesJobId, setGenCasesJobId] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(GEN_JOB_KEY);
    } catch {
      return null;
    }
  });
  const [genCasesJobStatus, setGenCasesJobStatus] = useState<"pending" | "running" | "completed" | "failed" | null>(null);
  const [genCasesJobResult, setGenCasesJobResult] = useState<{ created: number; attachmentErrors: string[] } | null>(null);
  const [genCasesJobError, setGenCasesJobError] = useState<string | null>(null);
  const genCasesPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { data: list = [], isLoading } = useQuery(
    ["test-cases", requirementFilter, priorityFilter],
    () => testCasesApi.list({ requirementId: requirementFilter, priority: priorityFilter }),
    { refetchOnMount: "always", refetchOnWindowFocus: false }
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
  const batchRemove = useMutation(
    (ids: string[]) => testCasesApi.batchDelete(ids),
    {
      onSuccess: (data) => {
        client.invalidateQueries("test-cases");
        setSelectedRowKeys([]);
        message.success(`已批量删除 ${data.deleted} 条`);
      },
      onError: (e: { response?: { data?: { error?: string } } }) =>
        message.error(e.response?.data?.error ?? "批量删除失败"),
    }
  );
  const genCasesStart = useMutation(
    (params: { requirementId: string; includeHistory: boolean; historyCount: number }) =>
      generateApi.testCasesStart({
        requirementId: params.requirementId,
        includeHistory: params.includeHistory,
        historyCount: params.historyCount,
      }),
    {
      onSuccess: (data) => {
        setGenCasesJobId(data.jobId);
        setGenCasesJobStatus("pending");
        setGenCasesJobResult(null);
        setGenCasesJobError(null);
        try {
          sessionStorage.setItem(GEN_JOB_KEY, data.jobId);
        } catch {}
        setTimeout(() => {
          setGenModalOpen(false);
          genForm.resetFields();
        }, 1000);
      },
      onError: (e: { response?: { data?: { error?: string } } }) =>
        message.error(e.response?.data?.error ?? "提交失败"),
    }
  );

  useEffect(() => {
    if (!genCasesJobId) return;
    const poll = () => {
      generateApi.testCasesStatus(genCasesJobId!).then(async (next) => {
        setGenCasesJobStatus(next.status);
        if (next.status === "completed") {
          if (genCasesPollRef.current) clearInterval(genCasesPollRef.current);
          genCasesPollRef.current = null;
          setGenCasesJobId(null);
          setGenCasesJobStatus(null);
          setGenCasesJobResult(null);
          setGenCasesJobError(null);
          try {
            sessionStorage.removeItem(GEN_JOB_KEY);
          } catch {}
          await client.invalidateQueries("test-cases");
          await client.refetchQueries("test-cases");
          await client.invalidateQueries("requirements");
          message.success(`已生成 ${next.result?.created ?? 0} 条测试用例`);
          if (next.result?.attachmentErrors?.length)
            message.warning(`部分附件未解析: ${next.result.attachmentErrors.join(", ")}`);
        } else if (next.status === "failed") {
          if (genCasesPollRef.current) clearInterval(genCasesPollRef.current);
          genCasesPollRef.current = null;
          setGenCasesJobId(null);
          setGenCasesJobStatus(null);
          setGenCasesJobError(next.error ?? "生成失败");
          try {
            sessionStorage.removeItem(GEN_JOB_KEY);
          } catch {}
          message.error(next.error ?? "生成失败");
        }
      }).catch(() => {});
    };
    poll();
    genCasesPollRef.current = setInterval(poll, 10000);
    return () => {
      if (genCasesPollRef.current) clearInterval(genCasesPollRef.current);
    };
  }, [genCasesJobId, client]);

  // jobId 存在但 status 未设时（如从 sessionStorage 恢复）设为 pending，以便立即显示占位
  useEffect(() => {
    if (genCasesJobId && genCasesJobStatus == null) {
      setGenCasesJobStatus("pending");
    }
  }, [genCasesJobId, genCasesJobStatus]);

  const doGenerateCases = (requirementId: string) => {
    genCasesStart.mutate({ requirementId, includeHistory, historyCount });
  };

  const closeGenModal = () => {
    setGenModalOpen(false);
    setGenCasesJobResult(null);
    setGenCasesJobError(null);
    genForm.resetFields();
    // 不清 jobId/status，以便刷新或切页后回到本页仍能继续轮询；仅关闭弹框
    if (genCasesPollRef.current) {
      clearInterval(genCasesPollRef.current);
      genCasesPollRef.current = null;
    }
  };

  const handleExportXmindSubmit = () => {
    exportForm.validateFields().then(async (v) => {
      const requirementId = v.requirementId as string;
      const cases = await testCasesApi.list({ requirementId });
      if (!cases.length) {
        message.warning("该需求下暂无测试用例，无法导出");
        return;
      }
      const req = requirements.find((r) => r.id === requirementId);
      const baseName = (req?.title ?? "导出")
        .replace(/[/\\:*?"<>|]/g, "_")
        .trim() || "导出";
      setExportLoading(true);
      try {
        const blob = await exportApi.xmind({
          requirementIds: [requirementId],
          format: "mm",
        });
        downloadBlob(blob, `${baseName}_测试用例.mm`);
        message.success("导出成功");
        setExportModalOpen(false);
        exportForm.resetFields();
      } catch {
        message.error("导出失败");
      } finally {
        setExportLoading(false);
      }
    });
  };

  const handleGenSubmit = () => {
    genForm.validateFields().then((v) => {
      const requirementId = v.requirementId as string;
      doGenerateCases(requirementId);
    });
  };

  const handleSubmit = () => {
    form.validateFields().then((v) => {
      if (editing) {
        update.mutate({
          id: editing.id,
          data: {
            caseId: v.caseId,
            featurePointL1: v.featurePointL1,
            featurePoint: v.featurePoint,
            title: v.title,
            priority: v.priority,
            preconditions: v.preconditions,
            steps: v.steps,
            expected: v.expected,
            validationPoints: v.validationPoints,
          },
        });
      } else {
        if (!v.requirementId) {
          message.error("请选择需求");
          return;
        }
        create.mutate({
          requirementId: v.requirementId,
          caseId: v.caseId,
          featurePointL1: v.featurePointL1,
          featurePoint: v.featurePoint,
          title: v.title,
          priority: v.priority,
          preconditions: v.preconditions,
          steps: v.steps,
          expected: v.expected,
          validationPoints: v.validationPoints,
        });
      }
    });
  };

  const isGenerating = genCasesJobStatus === "pending" || genCasesJobStatus === "running";
  const tableData: (TestCase & { _placeholder?: boolean })[] = isGenerating
    ? [{ id: "__generating__", caseId: "", title: "", requirementId: "", featurePointL1: null, featurePoint: null, priority: null, preconditions: null, steps: null, expected: null, validationPoints: null, _placeholder: true } as TestCase & { _placeholder?: boolean }, ...list]
    : list;

  return (
    <div>
      <div className="page-header">
        <Typography.Title level={4} className="page-title">测试用例列表</Typography.Title>
        <p className="page-desc">按需求或优先级筛选，生成用例或导出 XMind</p>
      </div>
      <div className="page-toolbar">
        <Space wrap size="middle">
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
          icon={<ExportOutlined />}
          onClick={() => {
            exportForm.setFieldsValue({ requirementId: requirementFilter });
            setExportModalOpen(true);
          }}
        >
          导出 XMind
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
        <Button
          danger
          icon={<DeleteOutlined />}
          disabled={selectedRowKeys.length === 0}
          onClick={() => {
            if (confirm(`确定删除选中的 ${selectedRowKeys.length} 条测试用例？`))
              batchRemove.mutate(selectedRowKeys as string[]);
          }}
        >
          批量删除{selectedRowKeys.length > 0 ? ` (${selectedRowKeys.length})` : ""}
        </Button>
      </Space>
      </div>
      <Table
        loading={isLoading && !isGenerating}
        rowKey="id"
        dataSource={tableData}
        rowSelection={
          isGenerating
            ? undefined
            : {
                selectedRowKeys,
                onChange: (keys) => setSelectedRowKeys(keys),
                getCheckboxProps: (r) => ({ disabled: !!(r as { _placeholder?: boolean })._placeholder }),
              }
        }
        columns={[
          {
            title: "用例ID",
            dataIndex: "caseId",
            width: 100,
            render: (t: string, r: TestCase & { _placeholder?: boolean }) =>
              r._placeholder
                ? { children: <span style={{ color: "var(--ant-color-text-secondary)" }}><Spin size="small" style={{ marginRight: 8 }} />正在生成测试用例，请稍候…</span>, props: { colSpan: 8 } }
                : t,
          },
          {
            title: "一级功能点",
            dataIndex: "featurePointL1",
            width: 100,
            ellipsis: true,
            render: (_: unknown, r: TestCase & { _placeholder?: boolean }) =>
              r._placeholder ? { props: { colSpan: 0 } } : (r.featurePointL1 ?? "-"),
          },
          {
            title: "二级功能点",
            dataIndex: "featurePoint",
            width: 120,
            ellipsis: true,
            render: (_: unknown, r: TestCase & { _placeholder?: boolean }) =>
              r._placeholder ? { props: { colSpan: 0 } } : (r.featurePoint ?? "-"),
          },
          {
            title: "标题",
            dataIndex: "title",
            ellipsis: true,
            render: (_: unknown, r: TestCase & { _placeholder?: boolean }) =>
              r._placeholder ? { props: { colSpan: 0 } } : r.title,
          },
          {
            title: "优先级",
            dataIndex: "priority",
            width: 80,
            render: (_: unknown, r: TestCase & { _placeholder?: boolean }) =>
              r._placeholder ? { props: { colSpan: 0 } } : (r.priority ?? "-"),
          },
          {
            title: "所属需求",
            dataIndex: ["requirement", "title"],
            width: 180,
            ellipsis: true,
            render: (_: unknown, r: TestCase & { _placeholder?: boolean }) =>
              r._placeholder ? { props: { colSpan: 0 } } : (r.requirement?.title ?? "-"),
          },
          {
            title: "更新时间",
            dataIndex: "updatedAt",
            width: 160,
            render: (t: string, r: TestCase & { _placeholder?: boolean }) =>
              r._placeholder ? { props: { colSpan: 0 } } : (t ? new Date(t).toLocaleString("zh-CN") : "-"),
          },
          {
            title: "操作",
            width: 140,
            render: (_: unknown, r: TestCase & { _placeholder?: boolean }) =>
              r._placeholder ? { props: { colSpan: 0 } } : (
              <Space>
                <Link to={`/test-cases/${r.id}`}>详情</Link>
                <Button
                  type="link"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => {
                    setEditing(r);
                    form.setFieldsValue({
                      requirementId: r.requirementId,
                      caseId: r.caseId,
                      featurePointL1: r.featurePointL1 ?? "",
                      featurePoint: r.featurePoint ?? "",
                      title: r.title,
                      priority: r.priority,
                      preconditions: r.preconditions,
                      steps: r.steps,
                      expected: r.expected,
                      validationPoints: r.validationPoints ?? "",
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
            <Form.Item name="requirementId" label="所属需求" rules={[{ required: true }]}>
              <Select
                placeholder="选择需求"
                options={requirements.map((r) => ({ label: r.title, value: r.id }))}
              />
            </Form.Item>
          )}
          <Form.Item name="caseId" label="用例编号" rules={[{ required: true }]}>
            <Input placeholder="如 TC-001" />
          </Form.Item>
          <Form.Item name="featurePointL1" label="一级功能点">
            <Input placeholder="如 个人红包、群红包、账户余额（分类/大类）" />
          </Form.Item>
          <Form.Item name="featurePoint" label="二级功能点">
            <Input placeholder="如 红包领取、发送群红包（一级下的模块）" />
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
          <Form.Item name="validationPoints" label="验证点">
            <Input.TextArea rows={3} placeholder="多条可换行填写，用于确认预期结果的检查项" />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title="根据需求生成测试用例"
        open={genModalOpen}
        onOk={handleGenSubmit}
        onCancel={closeGenModal}
        okText="生成"
        cancelText="取消"
        confirmLoading={genCasesStart.isLoading}
        okButtonProps={{ disabled: genCasesJobStatus === "pending" || genCasesJobStatus === "running" }}
      >
        <p style={{ color: "#cbd5e1", marginBottom: 16 }}>
          将根据所选需求内容（及可选的历史相关需求）调用模型直接生成测试用例。
        </p>
        {genCasesJobStatus === "pending" && (
          <div style={{ marginBottom: 16, padding: 12, background: "rgba(255,255,255,0.04)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)" }}>
            排队中…
          </div>
        )}
        {genCasesJobStatus === "running" && (
          <div style={{ marginBottom: 16, padding: 12, background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.4)", borderRadius: 8 }}>
            后台生成中…
          </div>
        )}
        {genCasesJobStatus === "completed" && genCasesJobResult && (
          <div style={{ marginBottom: 16, padding: 12, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.4)", borderRadius: 8 }}>
            已生成 {genCasesJobResult.created} 条测试用例。
          </div>
        )}
        {genCasesJobStatus === "failed" && genCasesJobError && (
          <div style={{ marginBottom: 16, padding: 12, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.4)", borderRadius: 8 }}>
            {genCasesJobError}
          </div>
        )}
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
      <Modal
        title="导出 XMind"
        open={exportModalOpen}
        onOk={handleExportXmindSubmit}
        onCancel={() => { setExportModalOpen(false); exportForm.resetFields(); }}
        okText="导出"
        cancelText="取消"
        confirmLoading={exportLoading}
      >
        <p style={{ color: "#cbd5e1", marginBottom: 16 }}>
          选择需求后，将导出该需求下的测试用例为 XMind 文件（.mm）。
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
