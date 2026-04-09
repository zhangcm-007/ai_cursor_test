import { useQuery, useMutation, useQueryClient } from "react-query";
import { Button, Collapse, Form, Input, Modal, Space, Table, Tag, Typography, message } from "antd";
import { PlusOutlined, DeleteOutlined, EditOutlined, QuestionCircleOutlined } from "@ant-design/icons";
import { useState } from "react";
import { apiRegressionApi, type ApiEnvironment } from "../api/api-regression";
import { RunVariablesFieldList } from "../components/RunVariablesFieldList";
import {
  varListToVariablesJson,
  variablesJsonToVarList,
  mergedEnvironmentVariablesRecord,
  type RunVarFormRow,
} from "../utils/runVariablesForm";

const BUILTIN_PLACEHOLDERS = [
  { syntax: "{{$uuid}}", desc: "随机 UUID", example: "a1b2c3d4-e5f6-..." },
  { syntax: "{{$timestamp}}", desc: "当前时间戳（秒）", example: "1711234567" },
  { syntax: "{{$timestampMs}}", desc: "当前时间戳（毫秒）", example: "1711234567890" },
  { syntax: "{{$randInt}}", desc: "随机整数 0~999999", example: "382715" },
  { syntax: "{{$randInt|1|100}}", desc: "指定范围随机整数", example: "42" },
  { syntax: "{{$randEmail}}", desc: "随机邮箱", example: "test382715@example.com" },
  { syntax: "{{$randEmail|manji|}}", desc: "固定前缀，默认域名", example: "manji382715@example.com" },
  { syntax: "{{$randEmail||qq.com}}", desc: "默认前缀，固定域名", example: "test382715@qq.com" },
  { syntax: "{{$randEmail|manji|qq.com}}", desc: "固定前缀 + 固定域名", example: "manji382715@qq.com" },
  { syntax: "{{$randPick|值1|值2|值3}}", desc: "从自定义列表随机取一个值", example: "值1 或 值2 或 值3" },
  { syntax: "{{$encPwd|明文密码}}", desc: "AiWealth 密码混淆（显式传入）", example: "2pSO2UDNzITMhFEQ6llJ" },
  { syntax: "{{rawPwd}}", desc: "变量名以 Pwd 结尾 → 引用时自动加密", example: "rawPwd=Aa123456 → 加密值" },
];

function BuiltinPlaceholderHelp() {
  return (
    <Collapse
      bordered={false}
      size="small"
      style={{ background: "transparent", marginBottom: 8 }}
      items={[{
        key: "help",
        label: (
          <Space size={4}>
            <QuestionCircleOutlined style={{ color: "#1890ff" }} />
            <Typography.Text style={{ fontSize: 12, color: "#1890ff" }}>内置函数用法</Typography.Text>
          </Space>
        ),
        children: (
          <div style={{ fontSize: 12 }}>
            <Typography.Text type="secondary" style={{ display: "block", marginBottom: 8 }}>
              在变量值中使用 <code>{"{{函数名}}"}</code>，调试或运行时自动替换为动态值。
            </Typography.Text>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                  <th style={{ textAlign: "left", padding: "4px 8px", fontSize: 11, color: "#8c8c8c" }}>写法</th>
                  <th style={{ textAlign: "left", padding: "4px 8px", fontSize: 11, color: "#8c8c8c" }}>说明</th>
                  <th style={{ textAlign: "left", padding: "4px 8px", fontSize: 11, color: "#8c8c8c" }}>示例输出</th>
                </tr>
              </thead>
              <tbody>
                {BUILTIN_PLACEHOLDERS.map((p, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ padding: "4px 8px" }}>
                      <Tag style={{ fontSize: 11, margin: 0, fontFamily: "monospace" }}>{p.syntax}</Tag>
                    </td>
                    <td style={{ padding: "4px 8px", color: "#d9d9d9" }}>{p.desc}</td>
                    <td style={{ padding: "4px 8px" }}>
                      <Typography.Text code style={{ fontSize: 11 }}>{p.example}</Typography.Text>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: 10, padding: "6px 10px", background: "rgba(250,173,20,0.08)", borderRadius: 4, border: "1px solid rgba(250,173,20,0.25)" }}>
              <Typography.Text style={{ fontSize: 11, color: "#faad14" }}>
                提示：变量名以 <b>Pwd</b> 结尾（如 rawPwd、loginPwd），值填明文密码，引用时自动进行 AiWealth 密码加密。
              </Typography.Text>
            </div>
          </div>
        ),
      }]}
    />
  );
}

export default function ApiRegressionEnvironments() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ApiEnvironment | null>(null);
  const [form] = Form.useForm();
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery("api-envs", apiRegressionApi.environments.list);

  const closeModal = () => {
    setOpen(false);
    setEditing(null);
    form.resetFields();
  };

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ envVarList: [], envAutoVarList: [] });
    setOpen(true);
  };

  const openEdit = (r: ApiEnvironment) => {
    setEditing(r);
    form.setFieldsValue({
      name: r.name,
      baseUrl: r.baseUrl,
      envVarList: variablesJsonToVarList(r.variables),
      envAutoVarList: variablesJsonToVarList(r.autoExtractedVariables),
    });
    setOpen(true);
  };

  const create = useMutation(apiRegressionApi.environments.create, {
    onSuccess: () => {
      qc.invalidateQueries("api-envs");
      message.success("已创建");
      closeModal();
    },
    onError: (e: { response?: { data?: { detail?: string } } }) => {
      message.error(e.response?.data?.detail ?? "失败");
    },
  });

  const update = useMutation(
    ({
      id,
      body,
    }: {
      id: string;
      body: { name: string; baseUrl: string; variables: string; autoExtractedVariables: string };
    }) => apiRegressionApi.environments.update(id, body),
    {
      onSuccess: () => {
        qc.invalidateQueries("api-envs");
        message.success("已保存");
        closeModal();
      },
      onError: (e: { response?: { data?: { detail?: string } } }) => {
        message.error(e.response?.data?.detail ?? "保存失败");
      },
    }
  );

  const remove = useMutation(apiRegressionApi.environments.delete, {
    onSuccess: () => {
      qc.invalidateQueries("api-envs");
      message.success("已删除");
    },
  });

  return (
    <div>
      <Typography.Title level={4} className="page-title">
        接口测试 · 环境
      </Typography.Title>
      <p className="page-desc">
        每个环境有独立的 Base URL 与<strong>环境变量</strong>：下方分为<strong>手动维护</strong>与<strong>自动提取</strong>两块；合并后参与调试/运行（如{" "}
        <code>{"{{email}}"}</code>
        ），同名键以手动区为准。调试里「运行变量」仍可覆盖同名键。
      </p>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          新建环境
        </Button>
      </Space>
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={data}
        columns={[
          { title: "名称", dataIndex: "name", width: 160 },
          { title: "Base URL", dataIndex: "baseUrl", ellipsis: true },
          {
            title: "变量数",
            width: 88,
            render: (_, r) => Object.keys(mergedEnvironmentVariablesRecord(r)).length,
          },
          {
            title: "操作",
            width: 140,
            render: (_, r) => (
              <Space size={0} wrap>
                <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>
                  编辑
                </Button>
                <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => remove.mutate(r.id)}>
                  删除
                </Button>
              </Space>
            ),
          },
        ]}
      />
      <Modal
        title={editing ? "编辑环境" : "新建环境"}
        open={open}
        onCancel={closeModal}
        onOk={() => form.submit()}
        confirmLoading={create.isLoading || update.isLoading}
        destroyOnClose
        width={640}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ envVarList: [], envAutoVarList: [] }}
          onFinish={(v) => {
            const parsedManual = varListToVariablesJson(v.envVarList as RunVarFormRow[] | undefined);
            const parsedAuto = varListToVariablesJson(v.envAutoVarList as RunVarFormRow[] | undefined);
            if (!parsedManual.ok) {
              message.error(parsedManual.message);
              return;
            }
            if (!parsedAuto.ok) {
              message.error(parsedAuto.message);
              return;
            }
            const payload = {
              name: v.name as string,
              baseUrl: v.baseUrl as string,
              variables: parsedManual.json,
              autoExtractedVariables: parsedAuto.json,
            };
            if (editing) {
              update.mutate({ id: editing.id, body: payload });
            } else {
              create.mutate(payload);
            }
          }}
        >
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input placeholder="如：测试环境" />
          </Form.Item>
          <Form.Item name="baseUrl" label="Base URL" rules={[{ required: true }]}>
            <Input placeholder="https://test-api.example.com" />
          </Form.Item>
          <Form.Item
            label="手动维护的变量"
            extra="与 Path / Header / Body 中的 {{name}} 对应；值可以是固定值，也可以用内置函数生成动态值。同名键会覆盖「自动提取」区。"
          >
            <BuiltinPlaceholderHelp />
            <RunVariablesFieldList listName="envVarList" />
          </Form.Item>
          <Form.Item
            label="自动提取的变量"
            extra="由接口调试「自动提取到环境变量」写入；每次调试成功会按规则更新。可在此查看、删改；与手动区同名时以手动区为准。"
          >
            <RunVariablesFieldList listName="envAutoVarList" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
