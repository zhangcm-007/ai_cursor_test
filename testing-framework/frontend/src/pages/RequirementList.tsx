import { useQuery, useMutation, useQueryClient } from "react-query";
import { Button, Table, Space, Modal, Form, Input, Typography, message, Upload } from "antd";
import { Link } from "react-router-dom";
import { PlusOutlined, EditOutlined, DeleteOutlined, InboxOutlined } from "@ant-design/icons";
import { useState } from "react";
import { requirementsApi } from "../api/requirements";
import { attachmentsApi } from "../api/attachments";

const { Dragger } = Upload;

export default function RequirementList() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [form] = Form.useForm();
  const client = useQueryClient();

  const { data: list = [], isLoading } = useQuery(
    "requirements",
    requirementsApi.list
  );
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
        form.resetFields();
        message.success("创建成功");
      },
      onError: (e: { response?: { data?: { error?: string } } }) =>
        message.error(e.response?.data?.error ?? "创建失败"),
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
        form.resetFields();
        message.success("更新成功");
      },
      onError: (e: { response?: { data?: { error?: string } } }) =>
        message.error(e.response?.data?.error ?? "更新失败"),
    }
  );
  const remove = useMutation(requirementsApi.delete, {
    onSuccess: () => {
      client.invalidateQueries("requirements");
      message.success("已删除");
    },
    onError: (e: { response?: { data?: { error?: string } } }) =>
      message.error(e.response?.data?.error ?? "删除失败"),
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

  return (
    <div>
      <Typography.Title level={4}>需求列表</Typography.Title>
      <Space style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingId(null);
            form.resetFields();
            setModalOpen(true);
          }}
        >
          新建需求
        </Button>
      </Space>
      <Table
        loading={isLoading}
        rowKey="id"
        dataSource={list}
        columns={[
          { title: "标题", dataIndex: "title", width: 200, render: (t, r) => <Link to={`/requirements/${r.id}`}>{t}</Link> },
          { title: "内容", dataIndex: "content", ellipsis: true },
          { title: "测试点数量", dataIndex: ["_count", "testPoints"], width: 100 },
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
        onCancel={() => { setModalOpen(false); setEditingId(null); setPendingFiles([]); }}
        okText="确定"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true }]}>
            <Input placeholder="需求标题" />
          </Form.Item>
          <Form.Item name="content" label="内容">
            <Input.TextArea rows={4} placeholder="需求描述" />
          </Form.Item>
          <Form.Item label="附件">
            <Dragger
              multiple
              maxCount={20}
              fileList={pendingFiles.map((f, i) => ({ uid: String(i), name: f.name, status: "done" }))}
              beforeUpload={() => false}
              onRemove={(file) => {
                setPendingFiles((prev) => prev.filter((_, i) => String(i) !== file.uid));
              }}
              onChange={({ fileList }) => {
                const newFiles = fileList
                  .map((f) => f.originFileObj)
                  .filter((x): x is File => x instanceof File);
                setPendingFiles(newFiles);
              }}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.png,.jpg,.jpeg,.gif"
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined style={{ color: "#1890ff" }} />
              </p>
              <p className="ant-upload-text">点击或拖拽文件到此处上传</p>
              <p className="ant-upload-hint">支持 PDF、Word、Excel、图片等，单文件不超过 20MB</p>
            </Dragger>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
