import { useQuery, useMutation, useQueryClient } from "react-query";
import { Button, Form, Input, Modal, Space, Table, Typography, Upload, message } from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  UploadOutlined,
  ImportOutlined,
  BugOutlined,
  ExperimentOutlined,
  LinkOutlined,
} from "@ant-design/icons";
import { useState } from "react";
import { apiRegressionApi, type ApiEndpoint } from "../api/api-regression";
import { EndpointDebugModal } from "../components/EndpointDebugModal";
import { ApiTestGenerateModal } from "../components/ApiTestGenerateModal";
import { parseCurlCommand } from "../utils/parseCurl";

const { TextArea } = Input;

export default function ApiRegressionEndpoints() {
  const [open, setOpen] = useState(false);
  const [curlPaste, setCurlPaste] = useState("");
  const [form] = Form.useForm();
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugEp, setDebugEp] = useState<ApiEndpoint | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [genOpen, setGenOpen] = useState(false);
  const [genMode, setGenMode] = useState<"single" | "chain">("single");
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery("api-endpoints", apiRegressionApi.endpoints.list);
  const create = useMutation(apiRegressionApi.endpoints.create, {
    onSuccess: () => {
      qc.invalidateQueries("api-endpoints");
      message.success("已添加");
      setOpen(false);
      form.resetFields();
    },
    onError: (e: { response?: { data?: { detail?: string } } }) => {
      message.error(e.response?.data?.detail ?? "失败");
    },
  });
  const remove = useMutation(apiRegressionApi.endpoints.delete, {
    onSuccess: () => {
      qc.invalidateQueries("api-endpoints");
      message.success("已删除");
    },
  });
  const importJson = useMutation(apiRegressionApi.endpoints.importJson, {
    onSuccess: (r: { created: number }) => {
      qc.invalidateQueries("api-endpoints");
      message.success(`已导入 ${r.created} 条`);
    },
    onError: () => {
      message.error("导入失败");
    },
  });

  const openDebug = (ep: ApiEndpoint) => {
    if ((ep.protocol || "http").toLowerCase() !== "http" && (ep.protocol || "").toLowerCase() !== "https") {
      message.info("当前仅支持 HTTP/HTTPS 调试");
      return;
    }
    setDebugEp(ep);
    setDebugOpen(true);
  };

  return (
    <div>
      <Typography.Title level={4} className="page-title">
        接口测试 · 接口清单
      </Typography.Title>
      <p className="page-desc">
        手动维护接口；可在集合页从清单生成步骤。列表中可「调试」须先选测试环境（在环境页配置 baseUrl 与 variables）。SSE/WebRTC 可先登记 protocol，一期仅执行 HTTP。
        <Typography.Text type="secondary"> 从浏览器复制 curl 时，请使用 Bash 格式（见下方表单备注）。</Typography.Text>
      </p>
      <Space wrap style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setCurlPaste("");
            form.resetFields();
            form.setFieldsValue({ method: "GET", protocol: "http" });
            setOpen(true);
          }}
        >
          添加接口
        </Button>
        <Upload
          accept=".json,application/json"
          showUploadList={false}
          beforeUpload={(file) => {
            const reader = new FileReader();
            reader.onload = () => {
              try {
                const arr = JSON.parse(String(reader.result));
                if (!Array.isArray(arr)) {
                  message.error("JSON 须为数组");
                  return;
                }
                importJson.mutate(arr);
              } catch {
                message.error("JSON 解析失败");
              }
            };
            reader.readAsText(file);
            return false;
          }}
        >
          <Button icon={<UploadOutlined />}>批量导入 JSON</Button>
        </Upload>
        <Button
          icon={<ExperimentOutlined />}
          disabled={selectedRowKeys.length === 0}
          onClick={() => {
            setGenMode("single");
            setGenOpen(true);
          }}
        >
          生成单接口测试{selectedRowKeys.length > 0 ? ` (${selectedRowKeys.length})` : ""}
        </Button>
        <Button
          icon={<LinkOutlined />}
          disabled={selectedRowKeys.length < 2}
          onClick={() => {
            setGenMode("chain");
            setGenOpen(true);
          }}
        >
          分析依赖链路{selectedRowKeys.length >= 2 ? ` (${selectedRowKeys.length})` : ""}
        </Button>
      </Space>
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={data}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys as string[]),
        }}
        columns={[
          { title: "接口名称", dataIndex: "name", width: 200, ellipsis: true },
          { title: "方法", dataIndex: "method", width: 90 },
          { title: "Path", dataIndex: "path", ellipsis: true },
          { title: "协议", dataIndex: "protocol", width: 90 },
          {
            title: "操作",
            width: 140,
            render: (_, r) => (
              <Space size={0} wrap>
                <Button type="link" size="small" icon={<BugOutlined />} onClick={() => openDebug(r)}>
                  调试
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
        title="添加接口"
        open={open}
        confirmLoading={create.isLoading}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        destroyOnClose
        afterOpenChange={(vis) => {
          if (!vis) {
            setCurlPaste("");
            form.resetFields();
          }
        }}
        width={560}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ method: "GET", protocol: "http" }}
          onFinish={(v) => {
            create.mutate({
              method: v.method,
              path: v.path,
              name: (v.name as string)?.trim() || "",
              description: v.description,
              protocol: v.protocol,
              sampleRequest: v.sampleRequest || "",
              sampleHeaders: (v.sampleHeaders as string) || "",
            });
          }}
        >
          <Form.Item name="name" label="接口名称" rules={[{ required: true, message: "请填写接口名称" }]}>
            <Input placeholder="如：用户注册" allowClear />
          </Form.Item>
          <Form.Item
            label="从 curl 导入（可选）"
            extra="备注：仅支持 Bash 方式（macOS/Linux 终端、Git Bash、WSL 下「复制为 cURL」，续行为反斜杠 + 换行）。不支持 Windows「复制为 cURL (cmd)」。"
          >
            <Space direction="vertical" style={{ width: "100%" }} size={8}>
              <TextArea
                value={curlPaste}
                onChange={(e) => setCurlPaste(e.target.value)}
                placeholder={`Bash 格式示例（勿用 Windows CMD 复制）：\ncurl 'https://api.example.com/v1/users' \\\n  -H 'Authorization: Bearer xxx' \\\n  -H 'Content-Type: application/json' \\\n  --data '{"name":"a"}'`}
                rows={5}
                style={{ fontFamily: "monospace", fontSize: 12 }}
              />
              <Button
                icon={<ImportOutlined />}
                onClick={() => {
                  try {
                    const p = parseCurlCommand(curlPaste);
                    form.setFieldsValue({
                      method: p.method,
                      path: p.path,
                      name: p.name,
                      description: p.description,
                      protocol: p.protocol,
                      sampleRequest: p.sampleRequest || undefined,
                      sampleHeaders:
                        p.headers && Object.keys(p.headers).length > 0
                          ? JSON.stringify(p.headers, null, 2)
                          : undefined,
                    });
                    message.success("已根据 curl 填充表单，可再修改后保存");
                  } catch (e) {
                    message.error(e instanceof Error ? e.message : "解析失败");
                  }
                }}
              >
                解析 curl 并填充
              </Button>
            </Space>
          </Form.Item>
          <Form.Item name="method" label="Method" rules={[{ required: true }]}>
            <Input placeholder="GET" />
          </Form.Item>
          <Form.Item name="path" label="Path" rules={[{ required: true }]}>
            <Input placeholder="/api/v1/health" />
          </Form.Item>
          <Form.Item name="description" label="说明">
            <Input />
          </Form.Item>
          <Form.Item name="protocol" label="协议">
            <Input placeholder="http / sse / webrtc" />
          </Form.Item>
          <Form.Item
            name="sampleHeaders"
            label="请求头 JSON（可选）"
            extra="从 Windows CMD 格式 curl 解析时会自动填充；调试用，集合生成步骤仍不自动写入请求头。"
          >
            <TextArea rows={6} placeholder="{}" style={{ fontFamily: "monospace", fontSize: 12 }} />
          </Form.Item>
          <Form.Item name="sampleRequest" label="示例请求体 JSON（可选）">
            <TextArea
              rows={4}
              placeholder="从 curl 导入会填入 body；集合「从清单生成步骤」会把合法 JSON 对象/数组写入步骤的 request.json。"
              style={{ fontFamily: "monospace", fontSize: 12 }}
            />
          </Form.Item>
        </Form>
      </Modal>

      <EndpointDebugModal
        open={debugOpen}
        endpoint={debugEp}
        onClose={() => {
          setDebugOpen(false);
          setDebugEp(null);
        }}
      />

      <ApiTestGenerateModal
        open={genOpen}
        mode={genMode}
        selectedEndpoints={data.filter((ep) => selectedRowKeys.includes(ep.id))}
        onClose={() => {
          setGenOpen(false);
          qc.invalidateQueries("api-collections");
        }}
      />
    </div>
  );
}
