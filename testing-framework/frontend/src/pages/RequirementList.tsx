import { useQuery, useMutation, useQueryClient } from "react-query";
import {
  Button, Table, Space, Modal, Form, Input, Typography, message, Upload, Divider, Alert,
} from "antd";
import { Link } from "react-router-dom";
import {
  PlusOutlined, EditOutlined, DeleteOutlined, InboxOutlined, LinkOutlined, LoadingOutlined,
} from "@ant-design/icons";
import { useState, useRef, useCallback } from "react";
import { requirementsApi } from "../api/requirements";
import { attachmentsApi } from "../api/attachments";
import { modaoApi, assembleContent, base64ToFile } from "../api/modao";

const { Dragger } = Upload;

export default function RequirementList() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [form] = Form.useForm();
  const client = useQueryClient();

  const [modaoUrl, setModaoUrl] = useState("");
  const [modaoPassword, setModaoPassword] = useState("");
  const [modaoExtracting, setModaoExtracting] = useState(false);
  const [modaoProgress, setModaoProgress] = useState("");
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: list = [], isLoading } = useQuery(
    "requirements",
    requirementsApi.list
  );

  const resetModaoState = useCallback(() => {
    setModaoUrl("");
    setModaoPassword("");
    setModaoExtracting(false);
    setModaoProgress("");
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const handleModaoExtract = useCallback(async () => {
    if (!modaoUrl.trim()) {
      message.warning("请输入墨刀分享链接");
      return;
    }
    if (!modaoPassword.trim()) {
      message.warning("请输入访问密码");
      return;
    }

    setModaoExtracting(true);
    setModaoProgress("正在启动提取...");

    try {
      const { jobId } = await modaoApi.extractStart({
        url: modaoUrl.trim(),
        password: modaoPassword.trim(),
      });

      setModaoProgress("正在访问墨刀原型...");

      pollingRef.current = setInterval(async () => {
        try {
          const state = await modaoApi.extractStatus(jobId);

          if (state.status === "running") {
            setModaoProgress("正在提取页面内容和截图...");
          }

          if (state.status === "completed" && state.result) {
            if (pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
            }

            const { prototypeName, pages } = state.result;
            const contentText = assembleContent(pages);
            const currentContent = form.getFieldValue("content") || "";
            const newContent = currentContent
              ? `${currentContent}\n\n---\n\n${contentText}`
              : contentText;
            form.setFieldsValue({ content: newContent });

            if (!form.getFieldValue("title") && prototypeName) {
              form.setFieldsValue({ title: prototypeName });
            }

            const screenshotFiles = pages
              .filter((p) => p.screenshotBase64)
              .map((p) => base64ToFile(p.screenshotBase64, `墨刀-${p.name}.png`));

            if (screenshotFiles.length > 0) {
              setPendingFiles((prev) => [...prev, ...screenshotFiles]);
            }

            setModaoExtracting(false);
            setModaoProgress("");
            message.success(
              `已提取 ${pages.length} 个页面的内容${screenshotFiles.length > 0 ? `和 ${screenshotFiles.length} 张截图` : ""}`
            );
          }

          if (state.status === "failed") {
            if (pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
            }
            setModaoExtracting(false);
            setModaoProgress("");
            message.error(`提取失败: ${state.error || "未知错误"}`);
          }
        } catch {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          setModaoExtracting(false);
          setModaoProgress("");
          message.error("轮询提取状态失败");
        }
      }, 3000);
    } catch (err: unknown) {
      setModaoExtracting(false);
      setModaoProgress("");
      const e = err as { response?: { data?: { error?: string } } };
      message.error(e.response?.data?.error ?? "启动提取失败");
    }
  }, [modaoUrl, modaoPassword, form]);

  const create = useMutation(
    (payload: { title: string; content?: string; files?: File[] }) =>
      requirementsApi.create({ title: payload.title, content: payload.content }),
    {
      onSuccess: async (data, payload) => {
        const files = payload.files ?? [];
        if (files.length) {
          try {
            await attachmentsApi.upload(data.id, files);
          } catch {
            message.warning("需求已创建，但部分附件上传失败");
          }
        }
        client.invalidateQueries("requirements");
        setModalOpen(false);
        setPendingFiles([]);
        resetModaoState();
        form.resetFields();
        message.success("创建成功");
      },
      onError: (e: { response?: { data?: { error?: string } } }) => {
        message.error(e.response?.data?.error ?? "创建失败");
      },
    }
  );
  const update = useMutation(
    (p: { id: string; data: { title?: string; content?: string }; files?: File[] }) =>
      requirementsApi.update(p.id, p.data),
    {
      onSuccess: async (_data, variables) => {
        if (variables.files?.length) {
          try {
            await attachmentsApi.upload(variables.id, variables.files);
          } catch {
            message.warning("需求已更新，但部分附件上传失败");
          }
        }
        client.invalidateQueries("requirements");
        setModalOpen(false);
        setEditingId(null);
        setPendingFiles([]);
        resetModaoState();
        form.resetFields();
        message.success("更新成功");
      },
      onError: (e: { response?: { data?: { error?: string } } }) => {
        message.error(e.response?.data?.error ?? "更新失败");
      },
    }
  );
  const remove = useMutation(requirementsApi.delete, {
    onSuccess: () => {
      client.invalidateQueries("requirements");
      message.success("已删除");
    },
    onError: (e: { response?: { data?: { error?: string } } }) => {
      message.error(e.response?.data?.error ?? "删除失败");
    },
  });

  const handleSubmit = () => {
    form.validateFields().then((v) => {
      if (editingId) {
        update.mutate({
          id: editingId,
          data: { title: v.title, content: v.content },
          files: pendingFiles.length ? pendingFiles : undefined,
        });
      } else {
        create.mutate({ title: v.title, content: v.content, files: pendingFiles });
      }
    });
  };

  const handleModalCancel = () => {
    setModalOpen(false);
    setEditingId(null);
    setPendingFiles([]);
    resetModaoState();
  };

  return (
    <div>
      <div className="page-header">
        <Typography.Title level={4} className="page-title">需求列表</Typography.Title>
        <p className="page-desc">管理需求并上传附件，用于生成测试用例</p>
      </div>
      <div className="page-toolbar">
        <Space wrap size="middle">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingId(null);
              form.resetFields();
              resetModaoState();
              setModalOpen(true);
            }}
          >
            新建需求
          </Button>
        </Space>
      </div>
      <Table
        loading={isLoading}
        rowKey="id"
        dataSource={list}
        columns={[
          { title: "标题", dataIndex: "title", width: 200, render: (t, r) => <Link to={`/requirements/${r.id}`}>{t}</Link> },
          { title: "内容", dataIndex: "content", ellipsis: true },
          { title: "测试用例数量", dataIndex: "testCaseCount", width: 110 },
          {
            title: "操作",
            width: 160,
            render: (_, r) => (
              <Space>
                <Link to={`/requirements/${r.id}`}>详情</Link>
                <Button
                  type="link"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => {
                    setEditingId(r.id);
                    form.setFieldsValue({ title: r.title, content: r.content });
                    resetModaoState();
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
        title={editingId ? "编辑需求" : "新建需求"}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={handleModalCancel}
        okText="确定"
        cancelText="取消"
        okButtonProps={{ disabled: modaoExtracting }}
        width={640}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true }]}>
            <Input placeholder="需求标题" />
          </Form.Item>
          <Form.Item name="content" label="内容">
            <Input.TextArea rows={6} placeholder="需求描述（支持 Markdown 格式）" />
          </Form.Item>
          <Form.Item label="附件">
            <Dragger
              multiple
              maxCount={20}
              fileList={pendingFiles.map((f, i) => ({
                uid: String(i),
                name: f.name,
                status: "done" as const,
              }))}
              beforeUpload={() => false}
              onRemove={(file) => {
                setPendingFiles((prev) => prev.filter((_, i) => String(i) !== file.uid));
              }}
              onChange={({ fileList }) => {
                const newFiles: File[] = [];
                for (const f of fileList) {
                  const o = f.originFileObj;
                  if (o instanceof File) newFiles.push(o);
                }
                setPendingFiles(newFiles);
              }}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.png,.jpg,.jpeg,.gif"
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined style={{ color: "#6366f1" }} />
              </p>
              <p className="ant-upload-text">点击或拖拽文件到此处上传</p>
              <p className="ant-upload-hint">支持 PDF、Word、Excel、图片等，单文件不超过 20MB</p>
            </Dragger>
          </Form.Item>

          <Divider plain style={{ margin: "8px 0 16px", color: "#999", fontSize: 13 }}>
            <LinkOutlined /> 或从墨刀原型提取
          </Divider>

          <div style={{ display: "flex", gap: 8, marginBottom: modaoProgress ? 8 : 0 }}>
            <Input
              placeholder="墨刀分享链接"
              value={modaoUrl}
              onChange={(e) => setModaoUrl(e.target.value)}
              disabled={modaoExtracting}
              style={{ flex: 2 }}
              allowClear
            />
            <Input.Password
              placeholder="访问密码"
              value={modaoPassword}
              onChange={(e) => setModaoPassword(e.target.value)}
              disabled={modaoExtracting}
              style={{ flex: 1 }}
            />
            <Button
              type="primary"
              ghost
              onClick={handleModaoExtract}
              loading={modaoExtracting}
              icon={modaoExtracting ? <LoadingOutlined /> : <LinkOutlined />}
              disabled={modaoExtracting}
            >
              提取
            </Button>
          </div>

          {modaoProgress && (
            <Alert
              message={modaoProgress}
              type="info"
              showIcon
              icon={<LoadingOutlined />}
              style={{ marginBottom: 0 }}
            />
          )}
        </Form>
      </Modal>
    </div>
  );
}
