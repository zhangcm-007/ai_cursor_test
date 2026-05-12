import { useQuery } from "react-query";
import { Button, Card, Collapse, Descriptions, Space, Table, Tag, Typography, message } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import { useParams, Link } from "react-router-dom";
import { apiRegressionApi } from "../api/api-regression";
import { looksLikeHtml, HtmlResponseViewer } from "../components/ResponseBodyViewer";

export default function ApiRegressionRunDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useQuery(["api-run", id], () => apiRegressionApi.runs.get(id!), { enabled: !!id });

  const downloadMd = async () => {
    if (!id) return;
    try {
      const text = await apiRegressionApi.runs.reportMd(id);
      const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `api-run-${id}.md`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      message.error("导出失败");
    }
  };

  if (!id) return null;
  if (isLoading || !data) return <Typography.Paragraph>加载中…</Typography.Paragraph>;

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Link to="/api-tests/runs">← 返回列表</Link>
        <Button icon={<DownloadOutlined />} onClick={downloadMd}>
          导出 Markdown 报告
        </Button>
      </Space>
      <Typography.Title level={4}>运行详情</Typography.Title>
      <Descriptions bordered size="small" column={1} style={{ marginBottom: 16 }}>
        <Descriptions.Item label="ID">{data.id}</Descriptions.Item>
        <Descriptions.Item label="状态">
          <Tag color={data.status === "PASSED" ? "success" : data.status === "FAILED" ? "error" : "default"}>
            {data.status}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="环境">{data.environmentName}</Descriptions.Item>
        <Descriptions.Item label="Base URL">{data.baseUrlSnapshot}</Descriptions.Item>
        <Descriptions.Item label="回归模式">{data.regressionMode}</Descriptions.Item>
        <Descriptions.Item label="集合 ID">{data.collectionId}</Descriptions.Item>
        <Descriptions.Item label="错误摘要">{data.errorMessage || "无"}</Descriptions.Item>
      </Descriptions>
      <Card title="步骤">
        <Collapse
          items={data.steps.map((s) => ({
            key: s.id,
            label: (
              <Space>
                <Tag color={s.passed ? "success" : "error"}>{s.passed ? "通过" : "失败"}</Tag>
                <span>
                  {s.orderIndex}. {s.name}
                </span>
                <Typography.Text type="secondary">
                  {s.requestMethod} {s.statusCode != null ? s.statusCode : ""} {s.durationMs != null ? `${s.durationMs}ms` : ""}
                </Typography.Text>
              </Space>
            ),
            children: (
              <div>
                {s.error ? (
                  <Typography.Paragraph type="danger">
                    <strong>原因：</strong>
                    {s.error}
                  </Typography.Paragraph>
                ) : null}
                <Typography.Text strong>请求 URL</Typography.Text>
                <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>{s.requestUrl}</pre>
                {s.requestBodyMasked ? (
                  <>
                    <Typography.Text strong>
                      {s.requestMethod === "GET" ? "请求参数" : "请求体"}
                    </Typography.Text>
                    <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, maxHeight: 200, overflow: "auto", background: "rgba(0,0,0,0.04)", padding: 8, borderRadius: 4 }}>
                      {(() => { try { return JSON.stringify(JSON.parse(s.requestBodyMasked), null, 2); } catch { return s.requestBodyMasked; } })()}
                    </pre>
                  </>
                ) : null}
                <Typography.Text strong>断言</Typography.Text>
                <Table
                  size="small"
                  rowKey={(r) => String(r.index)}
                  dataSource={s.assertionResults}
                  pagination={false}
                  columns={[
                    {
                      title: "类型",
                      dataIndex: "type",
                      width: 140,
                    },
                    {
                      title: "结果",
                      dataIndex: "passed",
                      width: 80,
                      render: (p: boolean) => (p ? <Tag color="success">是</Tag> : <Tag color="error">否</Tag>),
                    },
                    { title: "说明", dataIndex: "message" },
                  ]}
                />
                <Typography.Text strong style={{ display: "block", marginTop: 8 }}>
                  响应（脱敏截断）
                </Typography.Text>
                {s.responseBodyMasked && looksLikeHtml(s.responseBodyMasked) ? (
                  <HtmlResponseViewer html={s.responseBodyMasked} maxHeight={240} />
                ) : (
                  <pre style={{ whiteSpace: "pre-wrap", fontSize: 11, maxHeight: 240, overflow: "auto" }}>
                    {s.responseBodyMasked || ""}
                  </pre>
                )}
              </div>
            ),
          }))}
        />
      </Card>
    </div>
  );
}
