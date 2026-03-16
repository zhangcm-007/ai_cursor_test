import { useQuery, useMutation, useQueryClient } from "react-query";
import { useParams, Link } from "react-router-dom";
import { Button, Card, Descriptions, Typography, message, Checkbox, Collapse, Input } from "antd";
import { ThunderboltOutlined } from "@ant-design/icons";
import { useState, useEffect, useRef } from "react";
import { requirementsApi } from "../api/requirements";
import { attachmentsApi } from "../api/attachments";
import { generateApi } from "../api/generate";
import type { RequirementAttachment } from "../api/client";

export default function RequirementDetail() {
  const { id } = useParams<{ id: string }>();
  const [includeHistory, setIncludeHistory] = useState(false);
  const [historyCount, setHistoryCount] = useState(5);
  const [genCasesJobId, setGenCasesJobId] = useState<string | null>(null);
  const [genCasesJobStatus, setGenCasesJobStatus] = useState<"pending" | "running" | "completed" | "failed" | null>(null);
  const pollCasesRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const client = useQueryClient();

  const { data: requirement, isLoading } = useQuery(
    ["requirement", id],
    () => requirementsApi.get(id!),
    { enabled: !!id }
  );

  const genCasesStart = useMutation(
    () => generateApi.testCasesStart({ requirementId: id!, includeHistory, historyCount }),
    {
      onSuccess: (data) => {
        setGenCasesJobId(data.jobId);
        setGenCasesJobStatus("pending");
      },
      onError: (e: { response?: { data?: { error?: string } } }) =>
        message.error(e.response?.data?.error ?? "提交失败"),
    }
  );

  useEffect(() => {
    if (!genCasesJobId || !id) return;
    const poll = () => {
      generateApi.testCasesStatus(genCasesJobId!).then((next) => {
        setGenCasesJobStatus(next.status);
        if (next.status === "completed") {
          if (pollCasesRef.current) clearInterval(pollCasesRef.current);
          pollCasesRef.current = null;
          setGenCasesJobId(null);
          client.invalidateQueries(["requirement", id]);
          client.invalidateQueries("test-cases");
          message.success(`已生成 ${next.result?.created ?? 0} 条测试用例`);
          if (next.result?.attachmentErrors?.length)
            message.warning(`部分附件未解析: ${next.result.attachmentErrors.join(", ")}`);
        } else if (next.status === "failed") {
          if (pollCasesRef.current) clearInterval(pollCasesRef.current);
          pollCasesRef.current = null;
          setGenCasesJobId(null);
          message.error(next.error ?? "生成失败");
        }
      }).catch(() => {});
    };
    poll();
    pollCasesRef.current = setInterval(poll, 10000);
    return () => {
      if (pollCasesRef.current) clearInterval(pollCasesRef.current);
    };
  }, [genCasesJobId, id, client]);

  if (!id) return null;
  if (isLoading || !requirement) return <div>加载中...</div>;

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 20 }}>
        <Typography.Title level={4} className="page-title" style={{ marginBottom: 4 }}>
          <Link to="/requirements">需求</Link> / {requirement.title}
        </Typography.Title>
      </div>
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
        <div style={{ marginTop: 16 }}>
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            loading={genCasesStart.isLoading || genCasesJobStatus === "pending" || genCasesJobStatus === "running"}
            onClick={() => genCasesStart.mutate()}
          >
            {genCasesJobStatus === "pending" || genCasesJobStatus === "running"
              ? (genCasesJobStatus === "pending" ? "排队中…" : "运行中…")
              : "根据需求生成测试用例"}
          </Button>
          <div style={{ marginTop: 12 }}>
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
        </div>
      </Card>
      {(requirement.attachments?.length ?? 0) > 0 && (
        <Card title="附件" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            {requirement.attachments!.map((a: RequirementAttachment) => {
              const isImage = (a.mimeType || "").startsWith("image/");
              const fileUrl = attachmentsApi.getFileUrl(a.id);
              const downloadUrl = attachmentsApi.getFileUrl(a.id, true);
              const hasExtracted = !!a.extractedText?.trim();
              return (
                <div
                  key={a.id}
                  style={{
                    border: "1px solid rgba(255,255,255,0.08)",
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
                  <div style={{ padding: "4px 8px", fontSize: 12, color: "#cbd5e1" }}>
                    {(a.size / 1024).toFixed(1)} KB
                  </div>
                  {hasExtracted && (
                    <div style={{ padding: "4px 8px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>解析内容</Typography.Text>
                      <pre
                        style={{
                          margin: "4px 0 0",
                          padding: 6,
                          maxHeight: 120,
                          overflow: "auto",
                          fontSize: 12,
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          background: "#0f172a",
                          border: "1px solid rgba(255,255,255,0.08)",
                          borderRadius: 4,
                          color: "#f1f5f9",
                        }}
                        title={a.extractedText!}
                      >
                        {a.extractedText!.length > 200
                          ? `${a.extractedText!.slice(0, 200)}…`
                          : a.extractedText}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {requirement.attachments!.some((a) => a.extractedText?.trim()) && (
            <Collapse
              style={{ marginTop: 16 }}
              items={[
                {
                  key: "parsed",
                  label: "附件解析内容（全文）",
                  children: (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      {requirement.attachments!.filter((a) => a.extractedText?.trim()).map((a) => (
                        <div key={a.id}>
                          <Typography.Text strong>{a.filename}</Typography.Text>
                          <pre
                            style={{
                              margin: "8px 0 0",
                              padding: 12,
                              background: "#0f172a",
                              border: "1px solid rgba(255,255,255,0.08)",
                              borderRadius: 6,
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-word",
                              fontSize: 13,
                              maxHeight: 400,
                              overflow: "auto",
                              color: "#f1f5f9",
                            }}
                          >
                            {a.extractedText!.trim()}
                          </pre>
                        </div>
                      ))}
                    </div>
                  ),
                },
              ]}
            />
          )}
        </Card>
      )}
    </div>
  );
}
