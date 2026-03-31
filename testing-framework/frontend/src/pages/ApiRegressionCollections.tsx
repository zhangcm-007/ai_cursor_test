import { useQuery, useMutation, useQueryClient } from "react-query";
import { Button, Form, Input, Modal, Space, Table, Typography, message } from "antd";
import { PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";
import { useState } from "react";
import { apiRegressionApi } from "../api/api-regression";
import { CollectionStepsExpandContent } from "../components/CollectionStepsTable";

export default function ApiRegressionCollections() {
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery("api-collections", apiRegressionApi.collections.list);
  const { data: endpoints = [] } = useQuery("api-endpoints", apiRegressionApi.endpoints.list);
  const create = useMutation(apiRegressionApi.collections.create, {
    onSuccess: () => {
      qc.invalidateQueries("api-collections");
      message.success("已创建");
      setOpen(false);
      form.resetFields();
    },
    onError: (e: { response?: { data?: { detail?: string } } }) => {
      message.error(e.response?.data?.detail ?? "失败");
    },
  });
  const remove = useMutation(apiRegressionApi.collections.delete, {
    onSuccess: () => {
      qc.invalidateQueries("api-collections");
      message.success("已删除");
    },
  });

  return (
    <div>
      <Typography.Title level={4} className="page-title">
        接口测试 · 集合
      </Typography.Title>
      <p className="page-desc">
        集合内为 JSON 步骤定义；点击行左侧展开可查看<strong>步骤与接口清单</strong>对应关系，可改<strong>步骤名</strong>（失焦自动保存）、对匹配到的 HTTP(S) 接口<strong>调试</strong>。进入详情可编辑完整 definition、从清单生成、运行。
      </p>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
          新建集合
        </Button>
      </Space>
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={data}
        expandable={{
          expandedRowRender: (record) => (
            <CollectionStepsExpandContent collectionId={record.id} endpoints={endpoints} />
          ),
        }}
        columns={[
          {
            title: "名称",
            dataIndex: "name",
            render: (t, r) => <Link to={`/api-tests/collections/${r.id}`}>{t}</Link>,
          },
          { title: "描述", dataIndex: "description", ellipsis: true },
          {
            title: "操作",
            width: 100,
            render: (_, r) => (
              <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => remove.mutate(r.id)}>
                删除
              </Button>
            ),
          },
        ]}
      />
      <Modal title="新建集合" open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} destroyOnClose>
        <Form
          form={form}
          layout="vertical"
          onFinish={(v) =>
            create.mutate({
              name: v.name,
              description: v.description || "",
              definition: '{"steps":[]}',
            })
          }
        >
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
