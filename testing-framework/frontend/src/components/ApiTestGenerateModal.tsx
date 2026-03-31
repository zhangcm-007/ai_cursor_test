import { useState, useEffect, useCallback, useRef } from "react";
import {
  Modal,
  Button,
  Steps,
  Table,
  Typography,
  Space,
  Tag,
  Spin,
  Alert,
  Card,
  List,
  Input,
  Popconfirm,
  Select,
} from "antd";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from "@ant-design/icons";
import { useQuery } from "react-query";
import {
  apiRegressionApi,
  type ApiEndpoint,
  type DependencyChain,
  type GenJobResult,
  type GenJobStatus,
} from "../api/api-regression";
import { useNavigate } from "react-router-dom";

interface Props {
  open: boolean;
  mode: "single" | "chain";
  selectedEndpoints: ApiEndpoint[];
  onClose: () => void;
}

type Phase = "confirm" | "dep-analyzing" | "dep-confirm" | "generating" | "preview" | "error";

export function ApiTestGenerateModal({ open, mode, selectedEndpoints, onClose }: Props) {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("confirm");
  const [chains, setChains] = useState<DependencyChain[]>([]);
  const [, setJobId] = useState<string | null>(null);
  const [jobResult, setJobResult] = useState<GenJobResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [envId, setEnvId] = useState<string | undefined>(undefined);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: envs = [] } = useQuery("api-environments", apiRegressionApi.environments.list);

  useEffect(() => {
    if (open) {
      setPhase("confirm");
      setChains([]);
      setJobId(null);
      setJobResult(null);
      setErrorMsg("");
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [open]);

  const pollJobStatus = useCallback(
    (jid: string) => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        try {
          const s: GenJobStatus = await apiRegressionApi.generate.status(jid);
          if (s.status === "completed" && s.result) {
            if (pollRef.current) clearInterval(pollRef.current);
            setJobResult(s.result);
            setPhase("preview");
          } else if (s.status === "failed") {
            if (pollRef.current) clearInterval(pollRef.current);
            setErrorMsg(s.error || "生成失败");
            setPhase("error");
          }
        } catch {
          /* keep polling */
        }
      }, 2000);
    },
    []
  );

  const startSingleGen = async () => {
    setPhase("generating");
    try {
      const r = await apiRegressionApi.generate.startSingleApiTests({
        endpointIds: selectedEndpoints.map((e) => e.id),
        environmentId: envId,
      });
      setJobId(r.jobId);
      pollJobStatus(r.jobId);
    } catch (e: any) {
      setErrorMsg(e?.response?.data?.detail || e?.message || "启动失败");
      setPhase("error");
    }
  };

  const startDepAnalysis = async () => {
    setPhase("dep-analyzing");
    try {
      const r = await apiRegressionApi.generate.analyzeDependencies({
        endpointIds: selectedEndpoints.map((e) => e.id),
      });
      setChains(r.chains || []);
      setPhase("dep-confirm");
    } catch (e: any) {
      setErrorMsg(e?.response?.data?.detail || e?.message || "分析失败");
      setPhase("error");
    }
  };

  const startChainGen = async () => {
    setPhase("generating");
    try {
      const r = await apiRegressionApi.generate.startChainTests({
        chains,
        endpointIds: selectedEndpoints.map((e) => e.id),
        environmentId: envId,
      });
      setJobId(r.jobId);
      pollJobStatus(r.jobId);
    } catch (e: any) {
      setErrorMsg(e?.response?.data?.detail || e?.message || "启动失败");
      setPhase("error");
    }
  };

  const removeChain = (idx: number) => setChains((prev) => prev.filter((_, i) => i !== idx));

  const moveChainStep = (chainIdx: number, stepIdx: number, dir: -1 | 1) => {
    setChains((prev) => {
      const next = [...prev];
      const chain = { ...next[chainIdx], steps: [...next[chainIdx].steps] };
      const target = stepIdx + dir;
      if (target < 0 || target >= chain.steps.length) return prev;
      [chain.steps[stepIdx], chain.steps[target]] = [chain.steps[target], chain.steps[stepIdx]];
      next[chainIdx] = chain;
      return next;
    });
  };

  const removeChainStep = (chainIdx: number, stepIdx: number) => {
    setChains((prev) => {
      const next = [...prev];
      const chain = { ...next[chainIdx], steps: next[chainIdx].steps.filter((_, i) => i !== stepIdx) };
      next[chainIdx] = chain;
      return next.filter((c) => c.steps.length > 0);
    });
  };

  const currentStep =
    phase === "confirm" ? 0
    : phase === "dep-analyzing" || phase === "dep-confirm" ? 1
    : phase === "generating" ? 2
    : phase === "preview" ? 3
    : 0;

  const stepsItems =
    mode === "single"
      ? [
          { title: "确认接口" },
          { title: "生成中" },
          { title: "查看结果" },
        ]
      : [
          { title: "确认接口" },
          { title: "依赖分析" },
          { title: "生成中" },
          { title: "查看结果" },
        ];

  const footer = () => {
    if (phase === "confirm") {
      return (
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button
            type="primary"
            onClick={mode === "single" ? startSingleGen : startDepAnalysis}
          >
            {mode === "single" ? "开始生成" : "开始分析依赖"}
          </Button>
        </Space>
      );
    }
    if (phase === "dep-confirm") {
      return (
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" disabled={chains.length === 0} onClick={startChainGen}>
            确认并生成测试用例
          </Button>
        </Space>
      );
    }
    if (phase === "preview" && jobResult) {
      return (
        <Space>
          <Button onClick={onClose}>关闭</Button>
          <Button
            type="primary"
            onClick={() => {
              if (jobResult.collections.length > 0) {
                navigate(`/api-regression/collections/${jobResult.collections[0].id}`);
              }
              onClose();
            }}
          >
            查看第一个集合
          </Button>
        </Space>
      );
    }
    if (phase === "error") {
      return (
        <Space>
          <Button onClick={onClose}>关闭</Button>
          <Button
            onClick={() => {
              setPhase("confirm");
              setErrorMsg("");
            }}
          >
            重试
          </Button>
        </Space>
      );
    }
    return <Button onClick={onClose}>取消</Button>;
  };

  return (
    <Modal
      title={mode === "single" ? "生成单接口测试用例" : "生成链路测试用例"}
      open={open}
      onCancel={onClose}
      width={800}
      footer={footer()}
      destroyOnClose
    >
      <Steps
        current={currentStep}
        items={stepsItems}
        size="small"
        style={{ marginBottom: 24 }}
        status={phase === "error" ? "error" : undefined}
      />

      {/* Phase: confirm */}
      {phase === "confirm" && (
        <div>
          <Typography.Paragraph>
            已选择 <strong>{selectedEndpoints.length}</strong> 个接口
            {mode === "single" ? "，将为每个接口生成参数校验、异常场景等测试用例。" : "，将分析接口间的依赖关系并生成链路测试。"}
          </Typography.Paragraph>
          <div style={{ marginBottom: 12 }}>
            <Typography.Text>选择环境（可选，用于参考环境变量）：</Typography.Text>
            <Select
              allowClear
              placeholder="不选择环境"
              style={{ width: 240, marginLeft: 8 }}
              value={envId}
              onChange={setEnvId}
              options={envs.map((e) => ({ label: e.name, value: e.id }))}
            />
          </div>
          <Table
            size="small"
            rowKey="id"
            dataSource={selectedEndpoints}
            pagination={false}
            columns={[
              { title: "接口名称", dataIndex: "name", ellipsis: true },
              { title: "方法", dataIndex: "method", width: 80 },
              { title: "路径", dataIndex: "path", ellipsis: true },
            ]}
          />
        </div>
      )}

      {/* Phase: dep-analyzing */}
      {phase === "dep-analyzing" && (
        <div style={{ textAlign: "center", padding: 48 }}>
          <Spin size="large" />
          <Typography.Paragraph style={{ marginTop: 16 }}>
            正在分析接口依赖关系...
          </Typography.Paragraph>
        </div>
      )}

      {/* Phase: dep-confirm */}
      {phase === "dep-confirm" && (
        <div>
          {chains.length === 0 ? (
            <Alert type="warning" message="未发现接口间的依赖关系" showIcon />
          ) : (
            <>
              <Typography.Paragraph>
                LLM 推荐了 <strong>{chains.length}</strong> 条依赖链路，请确认或调整：
              </Typography.Paragraph>
              {chains.map((chain, ci) => (
                <Card
                  key={ci}
                  size="small"
                  title={
                    <Space>
                      <Input
                        size="small"
                        value={chain.name}
                        style={{ width: 240 }}
                        onChange={(e) => {
                          setChains((prev) => {
                            const next = [...prev];
                            next[ci] = { ...next[ci], name: e.target.value };
                            return next;
                          });
                        }}
                      />
                      <Typography.Text type="secondary">{chain.description}</Typography.Text>
                    </Space>
                  }
                  extra={
                    <Popconfirm title="删除此链路？" onConfirm={() => removeChain(ci)}>
                      <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  }
                  style={{ marginBottom: 12 }}
                >
                  <List
                    size="small"
                    dataSource={chain.steps}
                    renderItem={(step, si) => (
                      <List.Item
                        actions={[
                          <Button
                            key="up"
                            size="small"
                            icon={<ArrowUpOutlined />}
                            disabled={si === 0}
                            onClick={() => moveChainStep(ci, si, -1)}
                          />,
                          <Button
                            key="down"
                            size="small"
                            icon={<ArrowDownOutlined />}
                            disabled={si === chain.steps.length - 1}
                            onClick={() => moveChainStep(ci, si, 1)}
                          />,
                          <Popconfirm key="del" title="删除此步骤？" onConfirm={() => removeChainStep(ci, si)}>
                            <Button size="small" danger icon={<DeleteOutlined />} />
                          </Popconfirm>,
                        ]}
                      >
                        <Space>
                          <Tag>{si + 1}</Tag>
                          <Tag color="blue">{step.method || "?"}</Tag>
                          <Typography.Text code>{step.path || step.endpointName || step.name}</Typography.Text>
                          <Typography.Text type="secondary">{step.name}</Typography.Text>
                          {step.extract && Object.keys(step.extract).length > 0 && (
                            <Tag color="green">提取: {Object.keys(step.extract).join(", ")}</Tag>
                          )}
                          {step.dependsOnVars && step.dependsOnVars.length > 0 && (
                            <Tag color="orange">依赖: {step.dependsOnVars.join(", ")}</Tag>
                          )}
                        </Space>
                      </List.Item>
                    )}
                  />
                </Card>
              ))}
            </>
          )}
        </div>
      )}

      {/* Phase: generating */}
      {phase === "generating" && (
        <div style={{ textAlign: "center", padding: 48 }}>
          <Spin size="large" />
          <Typography.Paragraph style={{ marginTop: 16 }}>
            正在调用 LLM 生成测试用例，请稍候...
          </Typography.Paragraph>
          <Typography.Text type="secondary">通常需要 30~120 秒</Typography.Text>
        </div>
      )}

      {/* Phase: preview */}
      {phase === "preview" && jobResult && (
        <div>
          <Alert
            type="success"
            showIcon
            icon={<CheckCircleOutlined />}
            message={`生成完成！共创建 ${jobResult.collections.length} 个测试集合，${jobResult.testCaseCount} 条测试用例文档`}
            style={{ marginBottom: 16 }}
          />
          <Typography.Title level={5}>生成的测试集合</Typography.Title>
          <Table
            size="small"
            rowKey="id"
            dataSource={jobResult.collections}
            pagination={false}
            columns={[
              { title: "集合名称", dataIndex: "name", ellipsis: true },
              { title: "步骤数", dataIndex: "stepCount", width: 100 },
              {
                title: "操作",
                width: 100,
                render: (_, r) => (
                  <Button
                    type="link"
                    size="small"
                    onClick={() => {
                      navigate(`/api-regression/collections/${r.id}`);
                      onClose();
                    }}
                  >
                    查看
                  </Button>
                ),
              },
            ]}
          />
          {jobResult.requirementId && (
            <Typography.Paragraph style={{ marginTop: 12 }} type="secondary">
              测试用例文档已关联到需求 ID: {jobResult.requirementId}
            </Typography.Paragraph>
          )}
        </div>
      )}

      {/* Phase: error */}
      {phase === "error" && (
        <Alert
          type="error"
          showIcon
          icon={<CloseCircleOutlined />}
          message="生成失败"
          description={errorMsg}
        />
      )}
    </Modal>
  );
}
