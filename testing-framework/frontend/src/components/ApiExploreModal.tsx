import { useState, useEffect, useRef, useCallback } from "react";
import {
  Modal,
  Button,
  Typography,
  Space,
  Tag,
  Input,
  InputNumber,
  Select,
  Collapse,
  Spin,
  message,
} from "antd";
import {
  ExperimentOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  StopOutlined,
} from "@ant-design/icons";
import { useQuery } from "react-query";
import {
  apiRegressionApi,
  type ApiEndpoint,
  type ExploreJobStatus,
  type ExploreStepProgress,
} from "../api/api-regression";

const CATEGORY_COLORS: Record<string, string> = {
  "正常流程": "green",
  "参数校验": "orange",
  "异常场景": "red",
  "边界值": "purple",
};

function StepCard({ step, index }: { step: ExploreStepProgress; index: number }) {
  const statusColor = step.statusCode
    ? step.statusCode >= 200 && step.statusCode < 300
      ? "#52c41a"
      : step.statusCode >= 400
        ? "#ff4d4f"
        : "#faad14"
    : "#999";

  return (
    <div
      style={{
        padding: "10px 14px",
        marginBottom: 8,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
        <Tag color="blue" style={{ margin: 0, fontSize: 11 }}>#{index + 1}</Tag>
        <Tag color={CATEGORY_COLORS[step.category] || "default"} style={{ margin: 0, fontSize: 11 }}>
          {step.category}
        </Tag>
        <Typography.Text strong style={{ fontSize: 13 }}>{step.name}</Typography.Text>
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <Tag style={{ margin: 0, color: statusColor, borderColor: statusColor, fontSize: 11 }}>
            {step.statusCode ?? "—"} · {step.durationMs}ms
          </Tag>
          <Tag color="geekblue" style={{ margin: 0, fontSize: 11 }}>
            {step.assertionCount} 断言
          </Tag>
        </span>
      </div>
      {step.reason ? (
        <Typography.Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>
          {step.reason}
        </Typography.Text>
      ) : null}
      <Collapse
        bordered={false}
        size="small"
        style={{ background: "transparent" }}
        items={[
          {
            key: "detail",
            label: (
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                {step.method} {step.requestUrl || step.path}
              </Typography.Text>
            ),
            children: (
              <div style={{ fontSize: 12 }}>
                {step.requestJson != null ? (
                  <div style={{ marginBottom: 6 }}>
                    <Typography.Text type="secondary" style={{ fontSize: 11, display: "block" }}>请求参数:</Typography.Text>
                    <pre style={{
                      margin: "2px 0 0",
                      padding: 6,
                      background: "rgba(0,0,0,0.2)",
                      borderRadius: 4,
                      maxHeight: 120,
                      overflow: "auto",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      fontSize: 11,
                    }}>
                      {typeof step.requestJson === "string"
                        ? step.requestJson
                        : JSON.stringify(step.requestJson, null, 2)}
                    </pre>
                  </div>
                ) : null}
                {step.responseBodyPreview ? (
                  <div style={{ marginBottom: 6 }}>
                    <Typography.Text type="secondary" style={{ fontSize: 11, display: "block" }}>响应体:</Typography.Text>
                    <pre style={{
                      margin: "2px 0 0",
                      padding: 6,
                      background: "rgba(0,0,0,0.2)",
                      borderRadius: 4,
                      maxHeight: 120,
                      overflow: "auto",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      fontSize: 11,
                    }}>
                      {step.responseBodyPreview}
                    </pre>
                  </div>
                ) : null}
                {step.assertions?.length ? (
                  <div>
                    <Typography.Text type="secondary" style={{ fontSize: 11, display: "block", marginBottom: 2 }}>断言:</Typography.Text>
                    <Space wrap size={[4, 4]}>
                      {step.assertions.map((a, ai) => (
                        <Tag key={ai} color="geekblue" style={{ fontSize: 10 }}>
                          {a.type}
                          {a.path ? `: ${a.path}` : ""}
                          {a.equals !== undefined ? ` = ${JSON.stringify(a.equals)}` : ""}
                          {a.contains ? ` ~ "${a.contains}"` : ""}
                        </Tag>
                      ))}
                    </Space>
                  </div>
                ) : null}
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}

interface Props {
  open: boolean;
  endpoint: ApiEndpoint | null;
  onClose: () => void;
}

type Phase = "config" | "running" | "done" | "error";

export function ApiExploreModal({ open, endpoint, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>("config");
  const [envId, setEnvId] = useState<string | undefined>();
  const [userPrompt, setUserPrompt] = useState("");
  const [maxRounds, setMaxRounds] = useState(12);
  const [, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ExploreJobStatus["progress"] | null>(null);
  const [result, setResult] = useState<ExploreJobStatus["result"] | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: envs = [] } = useQuery("api-envs", apiRegressionApi.environments.list);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!open) {
      stopPolling();
      setPhase("config");
      setJobId(null);
      setProgress(null);
      setResult(null);
      setErrorMsg("");
    }
  }, [open, stopPolling]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [progress?.steps?.length]);

  const startExplore = async () => {
    if (!endpoint) return;
    if (!envId) { message.warning("请选择调试环境"); return; }

    setPhase("running");
    setProgress(null);
    setResult(null);
    setErrorMsg("");

    try {
      const { jobId: jid } = await apiRegressionApi.explore.start({
        endpointId: endpoint.id,
        environmentId: envId,
        userPrompt,
        maxRounds,
      });
      setJobId(jid);

      pollRef.current = setInterval(async () => {
        try {
          const status: ExploreJobStatus = await apiRegressionApi.explore.progress(jid);
          if (status.progress) {
            setProgress(status.progress);
          }
          if (status.status === "completed") {
            stopPolling();
            setResult(status.result ?? null);
            if (status.progress) setProgress(status.progress);
            setPhase("done");
          } else if (status.status === "failed") {
            stopPolling();
            setErrorMsg(status.error || "探索失败");
            setPhase("error");
          }
        } catch {
          // keep polling on network errors
        }
      }, 2000);
    } catch (e) {
      setErrorMsg(String((e as Error).message || e));
      setPhase("error");
    }
  };

  const stepsCount = progress?.steps?.length ?? 0;
  const categories = [...new Set((progress?.steps ?? []).map((s) => s.category).filter(Boolean))];

  return (
    <Modal
      title={
        <Space>
          <ExperimentOutlined />
          <span>AI 探索测试{endpoint ? ` - ${endpoint.name || `${endpoint.method} ${endpoint.path}`}` : ""}</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      width={720}
      footer={
        phase === "config" ? (
          <Space>
            <Button onClick={onClose}>取消</Button>
            <Button type="primary" icon={<ExperimentOutlined />} onClick={startExplore}>
              开始探索
            </Button>
          </Space>
        ) : phase === "running" ? (
          <Button icon={<StopOutlined />} danger onClick={() => { stopPolling(); setPhase("done"); }}>
            停止探索
          </Button>
        ) : (
          <Button type="primary" onClick={onClose}>关闭</Button>
        )
      }
    >
      {phase === "config" ? (
        <div>
          <div style={{ marginBottom: 12 }}>
            <Typography.Text style={{ display: "block", marginBottom: 4, fontSize: 12 }}>调试环境 *</Typography.Text>
            <Select
              style={{ width: "100%" }}
              placeholder="选择调试环境"
              value={envId}
              onChange={setEnvId}
              options={envs.map((e) => ({ value: e.id, label: `${e.name} (${e.baseUrl})` }))}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <Typography.Text style={{ display: "block", marginBottom: 4, fontSize: 12 }}>
              测试需求描述（可选）
            </Typography.Text>
            <Input.TextArea
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              placeholder="例如：重点测试权限校验、参数缺失场景必须返回 error_code=10001"
              autoSize={{ minRows: 3, maxRows: 6 }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <Typography.Text style={{ display: "block", marginBottom: 4, fontSize: 12 }}>最大探索轮次</Typography.Text>
            <InputNumber min={3} max={20} value={maxRounds} onChange={(v) => setMaxRounds(v ?? 12)} />
          </div>
          {endpoint?.apiDoc ? (
            <Collapse
              bordered={false}
              size="small"
              style={{ background: "transparent" }}
              items={[{
                key: "doc",
                label: <Typography.Text type="secondary" style={{ fontSize: 12 }}>接口文档预览</Typography.Text>,
                children: (
                  <pre style={{
                    margin: 0,
                    padding: 8,
                    background: "rgba(0,0,0,0.15)",
                    borderRadius: 4,
                    maxHeight: 150,
                    overflow: "auto",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    fontSize: 11,
                  }}>
                    {endpoint.apiDoc}
                  </pre>
                ),
              }]}
            />
          ) : null}
        </div>
      ) : null}

      {phase === "running" || phase === "done" || phase === "error" ? (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
            {phase === "running" ? (
              <>
                <Spin size="small" />
                <Typography.Text>
                  探索中… ({progress?.currentRound ?? 0}/{progress?.maxRounds ?? maxRounds})
                </Typography.Text>
              </>
            ) : phase === "done" ? (
              <>
                <CheckCircleOutlined style={{ color: "#52c41a", fontSize: 16 }} />
                <Typography.Text>探索完成，共 {stepsCount} 个场景</Typography.Text>
              </>
            ) : (
              <>
                <CloseCircleOutlined style={{ color: "#ff4d4f", fontSize: 16 }} />
                <Typography.Text type="danger">探索失败：{errorMsg}</Typography.Text>
              </>
            )}
            {categories.length > 0 ? (
              <Space size={4} style={{ marginLeft: "auto" }}>
                {categories.map((c) => (
                  <Tag key={c} color={CATEGORY_COLORS[c] || "default"} style={{ fontSize: 10, margin: 0 }}>{c}</Tag>
                ))}
              </Space>
            ) : null}
          </div>

          <div
            ref={scrollRef}
            style={{ maxHeight: 420, overflowY: "auto", paddingRight: 4 }}
          >
            {(progress?.steps ?? []).map((step, i) => (
              <StepCard key={i} step={step} index={i} />
            ))}
            {phase === "running" && stepsCount === 0 ? (
              <div style={{ textAlign: "center", padding: 24 }}>
                <Spin />
                <Typography.Text type="secondary" style={{ display: "block", marginTop: 8 }}>
                  AI 正在规划第一个测试场景…
                </Typography.Text>
              </div>
            ) : null}
          </div>

          {phase === "done" && result ? (
            <div style={{
              marginTop: 12,
              padding: "8px 12px",
              background: "rgba(82,196,26,0.08)",
              border: "1px solid rgba(82,196,26,0.2)",
              borderRadius: 6,
            }}>
              <Typography.Text style={{ fontSize: 12 }}>
                已生成集合：
                {result.collections?.map((c) => (
                  <Tag key={c.id} color="blue" style={{ marginLeft: 4 }}>
                    <a href={`/api-tests/collections/${c.id}`} style={{ color: "inherit" }}>
                      {c.name} ({c.stepCount} 步)
                    </a>
                  </Tag>
                ))}
              </Typography.Text>
            </div>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}
