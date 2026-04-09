import { useState, useEffect, useRef } from "react";
import {
  Alert,
  Modal,
  Button,
  Steps,
  Table,
  Typography,
  Space,
  Tag,
  Input,
  Select,
  notification,
} from "antd";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
} from "@ant-design/icons";
import { useQuery } from "react-query";
import {
  apiRegressionApi,
  type ApiEndpoint,
  type GenJobStatus,
} from "../api/api-regression";

const NOTIF_KEY = "gen-test-job";
let _globalPollTimer: ReturnType<typeof setInterval> | null = null;

function startGlobalPoll(jobId: string) {
  if (_globalPollTimer) clearInterval(_globalPollTimer);
  _globalPollTimer = setInterval(async () => {
    try {
      const s: GenJobStatus = await apiRegressionApi.generate.status(jobId);
      if (s.status === "completed" && s.result) {
        if (_globalPollTimer) { clearInterval(_globalPollTimer); _globalPollTimer = null; }
        notification.success({
          key: NOTIF_KEY,
          message: "测试用例生成完成",
          description: `共创建 ${s.result.collections.length} 个测试集合，${s.result.testCaseCount} 条用例`,
          duration: 0,
        });
      } else if (s.status === "failed") {
        if (_globalPollTimer) { clearInterval(_globalPollTimer); _globalPollTimer = null; }
        notification.error({
          key: NOTIF_KEY,
          message: "测试用例生成失败",
          description: s.error || "未知错误",
          duration: 0,
        });
      }
    } catch {
      /* network hiccup — keep polling */
    }
  }, 3000);
}

interface Props {
  open: boolean;
  selectedEndpoints: ApiEndpoint[];
  onClose: () => void;
}

export function ApiTestGenerateModal({ open, selectedEndpoints, onClose }: Props) {
  const [phase, setPhase] = useState<"confirm" | "generating" | "error">("confirm");
  const [errorMsg, setErrorMsg] = useState("");
  const [envId, setEnvId] = useState<string | undefined>(undefined);
  const [globalPrompt, setGlobalPrompt] = useState("");
  const [countdown, setCountdown] = useState(0);
  const closeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: envs = [] } = useQuery("api-environments", apiRegressionApi.environments.list);

  useEffect(() => {
    if (open) {
      setPhase("confirm");
      setErrorMsg("");
      setGlobalPrompt("");
      setCountdown(0);
    }
    return () => {
      if (closeTimerRef.current) { clearInterval(closeTimerRef.current); closeTimerRef.current = null; }
    };
  }, [open]);

  const submitAndAutoClose = (jobId: string) => {
    notification.info({
      key: NOTIF_KEY,
      message: "测试用例正在后台生成",
      description: "通常需要 30~120 秒，完成后会通知你。",
      icon: <LoadingOutlined />,
      duration: 0,
    });
    startGlobalPoll(jobId);
    setCountdown(3);
    let n = 3;
    closeTimerRef.current = setInterval(() => {
      n--;
      setCountdown(n);
      if (n <= 0) {
        if (closeTimerRef.current) { clearInterval(closeTimerRef.current); closeTimerRef.current = null; }
        onClose();
      }
    }, 1000);
  };

  const startGen = async () => {
    setPhase("generating");
    try {
      const r = await apiRegressionApi.generate.startSingleApiTests({
        endpointIds: selectedEndpoints.map((e) => e.id),
        environmentId: envId,
        globalPrompt: globalPrompt.trim() || undefined,
      });
      submitAndAutoClose(r.jobId);
    } catch (e: any) {
      setErrorMsg(e?.response?.data?.detail || e?.message || "启动失败");
      setPhase("error");
    }
  };

  const footer = () => {
    if (phase === "confirm") {
      return (
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" onClick={startGen}>
            开始生成
          </Button>
        </Space>
      );
    }
    if (phase === "generating") {
      return (
        <Button onClick={onClose}>
          立即关闭（{countdown}s 后自动关闭）
        </Button>
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
      title="生成测试用例"
      open={open}
      onCancel={onClose}
      width={800}
      footer={footer()}
    >
      <Steps
        current={phase === "confirm" ? 0 : phase === "generating" ? 1 : 0}
        items={[{ title: "确认接口" }, { title: "已提交" }]}
        size="small"
        style={{ marginBottom: 24 }}
        status={phase === "error" ? "error" : undefined}
      />

      {phase === "confirm" && (
        <div>
          <Typography.Paragraph>
            已选择 <strong>{selectedEndpoints.length}</strong> 个接口，将为每个接口生成参数校验、异常场景等测试用例。
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
          <div style={{ marginBottom: 12 }}>
            <Typography.Text>补充说明（可选，所有接口共享）：</Typography.Text>
            <Input.TextArea
              value={globalPrompt}
              onChange={(e) => setGlobalPrompt(e.target.value)}
              placeholder={"填写本次生成的额外要求，例如：\n- 重点测试鉴权失败场景\n- 关注分页参数边界值\n- 需要覆盖并发请求场景"}
              rows={3}
              style={{ marginTop: 4, fontFamily: "monospace", fontSize: 12 }}
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
              {
                title: "接口文档",
                width: 90,
                render: (_, r) => (r.apiDoc?.trim() ? <Tag color="blue">已填写</Tag> : <Tag>未填写</Tag>),
              },
            ]}
          />
        </div>
      )}

      {phase === "generating" && (
        <div style={{ textAlign: "center", padding: 48 }}>
          <CheckCircleOutlined style={{ fontSize: 48, color: "#52c41a" }} />
          <Typography.Paragraph style={{ marginTop: 16, fontSize: 16 }}>
            任务已提交，正在后台生成测试用例
          </Typography.Paragraph>
          <Typography.Text type="secondary">
            弹窗将在 {countdown} 秒后自动关闭，完成后右上角会弹出通知。
          </Typography.Text>
        </div>
      )}

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
