import { useQuery, useMutation, useQueryClient } from "react-query";
import { useParams, Link } from "react-router-dom";
import { Button, Card, Descriptions, Table, Modal, Form, Input, Space, Typography, message, Checkbox } from "antd";
import { PlusOutlined, EditOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { useState } from "react";
import { requirementsApi } from "../api/requirements";
import { testPointsApi } from "../api/test-points";
import { attachmentsApi } from "../api/attachments";
import { generateApi } from "../api/generate";
import type { RequirementAttachment } from "../api/client";

export default function RequirementDetail() {
  const { id } = useParams<{ id: string }>();
  const [modalOpen, setModalOpen] = useState(false);
  const [includeHistory, setIncludeHistory] = useState(true);
  const [historyCount, setHistoryCount] = useState(5);
  const [form] = Form.useForm();
  const client = useQueryClient();

  const { data: requirement, isLoading } = useQuery(
    ["requirement", id],
    () => requirementsApi.get(id!),
    { enabled: !!id }
  );
  const createPoint = useMutation(testPointsApi.create, {
    onSuccess: () => {
      client.invalidateQueries(["requirement", id]);
      client.invalidateQueries("test-points");
      setModalOpen(false);
      form.resetFields();
      message.success("测试点已添加");
    },
    onError: (e: { response?: { data?: { error?: string } } }) =>
      message.error(e.response?.data?.error ?? "添加失败"),
  });
  const genPoints = useMutation(
    () => generateApi.testPoints({ requirementId: id!, includeHistory, historyCount }),
    {
      onSuccess: (data) => {
        client.invalidateQueries(["requirement", id]);
        client.invalidateQueries("test-points");
        message.success(`已生成 ${data.created} 个测试点`);
        if (data.attachmentErrors?.length)
          message.warning(`部分附件未解析: ${data.attachmentErrors.join(", ")}`);
      },
      onError: (e: { response?: { data?: { error?: string } } }) =>
        message.error(e.response?.data?.error ?? "生成失败"),
    }
  );
  const genCases = useMutation(
    () => generateApi.testCases({ requirementId: id!, includeHistory, historyCount }),
    {
      onSuccess: (data) => {
        client.invalidateQueries(["requirement", id]);
        client.invalidateQueries("test-cases");
        message.success(`已生成 ${data.created} 条测试用例`);
        if (data.attachmentErrors?.length)
          message.warning(`部分附件未解析: ${data.attachmentErrors.join(", ")}`);
      },
      onError: (e: { response?: { data?: { error?: string } } }) =>
        message.error(e.response?.data?.error ?? "生成失败"),
    }
  );

  if (!id) return null;
  if (isLoading || !requirement) return <div>加载中...</div>;

  const handleAddPoint = () => {
    form.validateFields().then((v) => {
      createPoint.mutate({
        requirementId: id,
        pointId: v.pointId,
        description: v.description,
        type: v.type,
      });
    });
  };

  return (
    <div>
      <Typography.Title level={4}>
        <Link to="/requirements">需求</Link> / {requirement.title}
      </Typography.Title>
      <Card style={{ marginBottom: 24 }}>
        <Descriptions column={1}>
          <Descriptions.Item label="标题">{requirement.title}</Descriptions.Item>
          <Descriptions.Item label="内容">
            <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{requirement.content || "-"}</pre>
          </Descriptions.Item>
          <Descriptions.Item label="更新时间">
            {new Date(requirement.updatedAt).toLocaleString("zh-CN")}
          </Descriptions.Item>
        </Descriptions>
        <Space>
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            loading={genPoints.isLoading}
            onClick={() => genPoints.mutate()}
          >
            根据需求生成测试点
          </Button>
          <Button
            icon={<ThunderboltOutlined />}
            loading={genCases.isLoading}
            onClick={() => genCases.mutate()}
            disabled={!(requirement.testPoints?.length)}
          >
            根据需求生成测试用例
          </Button>
          <Button icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            新建测试点
          </Button>
        </Space>
      </Card>
      <div style={{ marginBottom: 16 }}>
        <Checkbox checked={includeHistory} onChange={(e) => setIncludeHistory(e.target.checked)}>
          参考历史需求
        </Checkbox>
        {includeHistory && (
          <span style={{ marginLeft: 8 }}>
            条数
            <Input
              type="number"
              min={1}
              max={20}
              value={historyCount}
              onChange={(e) => setHistoryCount(Number(e.target.value) || 5)}
              style={{ width: 56, marginLeft: 4 }}
            />
          </span>
        )}
      </div>
      {(requirement.attachments?.length ?? 0) > 0 && (
        <Card title="附件" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            {requirement.attachments!.map((a: RequirementAttachment) => {
              const isImage = (a.mimeType || "").startsWith("image/");
              const fileUrl = attachmentsApi.getFileUrl(a.id);
              const downloadUrl = attachmentsApi.getFileUrl(a.id, true);
              return (
                <div
                  key={a.id}
                  style={{
                    border: "1px solid #eee",
                    borderRadius: 8,
                    overflow: "hidden",
                    maxWidth: 280,
                  }}
                >
                  {isImage ? (
                    <a href={downloadUrl} target="_blank" rel="noreferrer">
                      <img
                        src={fileUrl}
                        alt={a.filename}
                        style={{
                          display: "block",
                          maxWidth: 260,
                          maxHeight: 200,
                          objectFit: "contain",
                        }}
                      />
                    </a>
                  ) : (
                    <div style={{ padding: 12 }}>
                      <a href={downloadUrl} download>
                        {a.filename}
                      </a>
                    </div>
                  )}
                  <div style={{ padding: "4px 8px", fontSize: 12, color: "#666" }}>
                    {(a.size / 1024).toFixed(1)} KB
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
      <Card
        title="关联测试点"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            新建测试点
          </Button>
        }
      >
        {(!requirement.testPoints || requirement.testPoints.length === 0) ? (
          <div style={{ padding: 24, textAlign: "center", color: "#666" }}>
            <p>该需求暂无测试点。可根据需求内容与历史相关需求，由模型自动生成。</p>
            <Button
              type="primary"
              size="large"
              icon={<ThunderboltOutlined />}
              loading={genPoints.isLoading}
              onClick={() => genPoints.mutate()}
            >
              一键生成测试点
            </Button>
          </div>
        ) : (
          <Table
            rowKey="id"
            dataSource={requirement.testPoints ?? []}
            columns={[
              { title: "测试点ID", dataIndex: "pointId", width: 100 },
              { title: "描述", dataIndex: "description" },
              { title: "类型", dataIndex: "type", width: 80 },
              {
                title: "操作",
                width: 120,
                render: (_, row) => (
                  <Space>
                    <Link to={`/test-points/${row.id}`}>详情</Link>
                  </Space>
                ),
              },
            ]}
            pagination={false}
          />
        )}
      </Card>
      <Modal
        title="新建测试点"
        open={modalOpen}
        onOk={handleAddPoint}
        onCancel={() => setModalOpen(false)}
        okText="确定"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
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
    </div>
  );
}
