import { useQuery, useMutation, useQueryClient } from "react-query";
import { useParams, Link } from "react-router-dom";
import { Button, Card, Descriptions, Typography, message, Checkbox, Collapse, Input } from "antd";
import { ThunderboltOutlined } from "@ant-design/icons";
import { useState, useEffect, useRef } from "react";
import { requirementsApi } from "../api/requirements";
import { attachmentsApi } from "../api/attachments";
import { generateApi, readFilesAsDevCodeFiles } from "../api/generate";
import type { RequirementAttachment } from "../api/client";

export default function RequirementDetail() {
  const { id } = useParams<{ id: string }>();
  const [includeHistory, setIncludeHistory] = useState(false);
  const [historyCount, setHistoryCount] = useState(5);
  const [devCode, setDevCode] = useState("");
  const [devCodeFileList, setDevCodeFileList] = useState<File[]>([]);
  const [devCodeRefCommit, setDevCodeRefCommit] = useState("");
  const [devCodeRefPaths, setDevCodeRefPaths] = useState("");
  const devCodeFileInputRef = useRef<HTMLInputElement>(null);
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
    (variables: {
      devCode?: string;
      devCodeFiles?: { name: string; content: string }[];
      devCodeRef?: { commit: string; paths?: string[] };
    }) => {
      let code = (variables.devCode ?? devCode).trim() || undefined;
      if (code && code.length > 12000) {
        code = code.slice(0, 12000);
        message.info("开发代码已截断至 12000 字参与生成");
      }
      return generateApi.testCasesStart({
        requirementId: id!,
        includeHistory,
        historyCount,
        devCode: code,
        devCodeFiles: variables.devCodeFiles,
        devCodeRef: variables.devCodeRef,
      });
    },
    {
      onSuccess: (data) => {
        setGenCasesJobId(data.jobId);
        setGenCasesJobStatus("pending");
      },
      onError: (e: { response?: { data?: { error?: string } } }) => {
        message.error(e.response?.data?.error ?? "提交失败");
      },
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
            onClick={async () => {
              let devCodeFiles: { name: string; content: string }[] | undefined;
              if (devCodeFileList.length > 0) {
                try {
                  devCodeFiles = await readFilesAsDevCodeFiles(devCodeFileList);
                } catch (e) {
                  message.error(e instanceof Error ? e.message : "读取代码文件失败");
                  return;
                }
              }
              const commit = devCodeRefCommit.trim();
              const paths = devCodeRefPaths.trim()
                ? devCodeRefPaths.split(/[,，]/).map((s) => s.trim()).filter(Boolean)
                : undefined;
              const devCodeRef = commit ? { commit, paths } : undefined;
              genCasesStart.mutate({
                devCode: devCode.trim() || undefined,
                devCodeFiles,
                devCodeRef,
              });
            }}
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
          <div style={{ marginTop: 12 }}>
            <div style={{ marginBottom: 4, color: "rgba(255,255,255,0.65)", fontSize: 12 }}>
              或按提交记录拉取代码
            </div>
            <Input
              placeholder="commit 或分支，如 abc1234、main（需后端配置 DEV_CODE_REPO_PATH）"
              value={devCodeRefCommit}
              onChange={(e) => setDevCodeRefCommit(e.target.value)}
              style={{ marginBottom: 6 }}
            />
            <Input
              placeholder="路径前缀，逗号分隔，如 src/,lib/（可选）"
              value={devCodeRefPaths}
              onChange={(e) => setDevCodeRefPaths(e.target.value)}
              style={{ marginBottom: 12 }}
            />
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ marginBottom: 4, color: "rgba(255,255,255,0.65)", fontSize: 12 }}>
              开发代码（可选，推荐上传文件，以文档形式带给模型）
            </div>
            <input
              ref={devCodeFileInputRef}
              type="file"
              multiple
              accept=".ts,.tsx,.js,.jsx,.vue,.py,.go,.java,.rs,.txt,.json,.md,.css,.html"
              style={{ fontSize: 12, marginBottom: 8 }}
              onChange={(e) => {
                const list = e.target.files ? Array.from(e.target.files) : [];
                setDevCodeFileList(list);
              }}
            />
            {devCodeFileList.length > 0 && (
              <div style={{ marginBottom: 8, color: "rgba(255,255,255,0.6)", fontSize: 12 }}>
                已选 {devCodeFileList.length} 个文件：{devCodeFileList.map((f) => f.name).join("、")}
              </div>
            )}
            <Input.TextArea
              rows={4}
              value={devCode}
              onChange={(e) => setDevCode(e.target.value)}
              placeholder="或粘贴代码片段（可与上传文件同时使用）"
              style={{ fontFamily: "monospace" }}
            />
            <div style={{ marginTop: 4, color: "rgba(255,255,255,0.45)", fontSize: 12 }}>
              上传文件会带文件名与语言标识，便于模型按文档理解。
            </div>
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
