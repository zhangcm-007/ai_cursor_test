import pathlib

header = r'''import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "react-query";
import {
  Alert,
  Button,
  Collapse,
  Form,
  Input,
  Modal,
  Popover,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import {
  BugOutlined,
  CopyOutlined,
  SaveOutlined,
  InfoCircleOutlined,
  CloudUploadOutlined,
} from "@ant-design/icons";
import {
  apiRegressionApi,
  type ApiDebugResult,
  type ApiEndpoint,
  type ApiEnvironment,
} from "../api/api-regression";
import { JsonResponseAssertButtons } from "./JsonResponseAssertButtons";
import { DebugAssertionsFieldList } from "./DebugAssertionsFieldList";
import { RunVariablesFieldList } from "./RunVariablesFieldList";
import {
  appendAssertionToDebugForm,
  serializeAssertListForApi,
  type DebugAssertFormRow,
} from "../utils/debugAssertions";
import { mergeVariablesJsonWithRecord, runVarListToRecord, type RunVarFormRow } from "../utils/runVariablesForm";
import {
  buildDebugModalDefaults,
  debugFormValuesToDraftJson,
  hasSavedDebugDraft,
  mergeDebugDraftIntoDefaults,
} from "../utils/debugDraft";

const { TextArea } = Input;

function parseDebugBody(text: string): { json?: unknown; body?: string } {
  const t = text.trim();
  if (!t) return {};
  try {
    const v = JSON.parse(t) as unknown;
    if (v !== null && typeof v === "object") return { json: v };
  } catch {
    /* raw */
  }
  return { body: t };
}

function formatDebugResponseBody(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  try {
    return JSON.stringify(JSON.parse(t), null, 2);
  } catch {
    return raw;
  }
}

export type EndpointDebugModalProps = {
  open: boolean;
  endpoint: ApiEndpoint | null;
  onClose: () => void;
};

export function EndpointDebugModal({ open, endpoint, onClose }: EndpointDebugModalProps) {
  const [localEp, setLocalEp] = useState<ApiEndpoint | null>(null);
  const [debugResult, setDebugResult] = useState<ApiDebugResult | null>(null);
  const [debugForm] = Form.useForm();
  const [syncToEnvTarget, setSyncToEnvTarget] = useState<number | "all" | null>(null);
  const qc = useQueryClient();
  const { data: environments = [] } = useQuery("api-envs", apiRegressionApi.environments.list);

  useEffect(() => {
    if (!open) {
      setLocalEp(null);
      setDebugResult(null);
      return;
    }
    if (endpoint) setLocalEp(endpoint);
  }, [open, endpoint]);

  const saveDebugDraftMut = useMutation(
    ({ id, debugDraft }: { id: string; debugDraft: string }) =>
      apiRegressionApi.endpoints.update(id, { debugDraft }),
    {
      onSuccess: (_, vars) => {
        qc.invalidateQueries("api-endpoints");
        message.success("调试内容已保存，下次打开将自动恢复");
        setLocalEp((prev) => (prev && prev.id === vars.id ? { ...prev, debugDraft: vars.debugDraft } : prev));
      },
      onError: (e: { response?: { data?: { detail?: string } } }) => {
        message.error(e.response?.data?.detail ?? "保存调试失败");
      },
    }
  );

  const syncRunVarsToEnvironment = useMutation(
    ({ environmentId, variables }: { environmentId: string; variables: string }) =>
      apiRegressionApi.environments.update(environmentId, { variables }),
    {
      onSuccess: () => {
        qc.invalidateQueries("api-environments");
        qc.invalidateQueries("api-envs");
      },
      onSettled: () => setSyncToEnvTarget(null),
      onError: (e: { response?: { data?: { detail?: string } } }) => {
        message.error(e.response?.data?.detail ?? "同步到环境失败");
      },
    }
  );

  const debugReq = useMutation(apiRegressionApi.debug.request, {
    onSuccess: (r) => {
      setDebugResult(r);
      if (r.error) message.warning("请求异常，见下方详情");
      else if (r.assertionsPassed === false) message.error("断言未通过");
      else if (r.assertionsPassed === true) message.success(`断言通过 · ${r.durationMs} ms`);
      else message.success(`完成 ${r.durationMs} ms`);
    },
    onError: (e: { response?: { data?: { detail?: string } } }) => {
      message.error(e.response?.data?.detail ?? "调试请求失败");
    },
  });

  useEffect(() => {
    if (!open || !localEp) return;
    const base = buildDebugModalDefaults(localEp, environments);
    const merged = mergeDebugDraftIntoDefaults(base, localEp.debugDraft, environments);
    debugForm.setFieldsValue(merged);
    setDebugResult(null);
  }, [open, localEp, environments, debugForm]);

  const resolveDebugEnvironment = (): { envId: string; env: ApiEnvironment } | null => {
    const envId = debugForm.getFieldValue("environmentId") as string | undefined;
    if (!envId) {
      message.warning("请先选择环境");
      return null;
    }
    const env = environments.find((e) => e.id === envId);
    if (!env) {
      message.error("环境不存在，请刷新后重试");
      return null;
    }
    return { envId, env };
  };

  const handleSyncOneRunVarToEnvironment = (fieldIndex: number) => {
    const resolved = resolveDebugEnvironment();
    if (!resolved) return;
    const { envId, env } = resolved;
    const list = debugForm.getFieldValue("runVarList") as RunVarFormRow[] | undefined;
    const row = list?.[fieldIndex];
    if (!row) {
      message.warning("未找到该行");
      return;
    }
    const k = (row.varName ?? "").trim();
    if (!k) {
      message.warning("请先填写变量名");
      return;
    }
    if (!/^\w+$/.test(k)) {
      message.error("变量名仅支持字母数字下划线");
      return;
    }
    const patch = { [k]: String(row.varValue ?? "") };
    const merged = mergeVariablesJsonWithRecord(env.variables, patch);
    setSyncToEnvTarget(fieldIndex);
    syncRunVarsToEnvironment.mutate(
      { environmentId: envId, variables: merged },
      {
        onSuccess: () => {
          message.success(`已将变量「${k}」合并到环境「${env.name}」（同名键已覆盖）`);
        },
      }
    );
  };

  const handleSyncRunVarsToEnvironment = () => {
    const resolved = resolveDebugEnvironment();
    if (!resolved) return;
    const { envId, env } = resolved;
    const rows = debugForm.getFieldValue("runVarList") as RunVarFormRow[] | undefined;
    const parsed = runVarListToRecord(rows);
    if (!parsed.ok) {
      message.error(parsed.message);
      return;
    }
    if (!parsed.record || Object.keys(parsed.record).length === 0) {
      message.warning("请先在「运行变量」中填写至少一条有效的变量名与值");
      return;
    }
    const merged = mergeVariablesJsonWithRecord(env.variables, parsed.record);
    const n = Object.keys(parsed.record).length;
    setSyncToEnvTarget("all");
    syncRunVarsToEnvironment.mutate(
      { environmentId: envId, variables: merged },
      {
        onSuccess: () => {
          message.success(`已将全部 ${n} 个运行变量合并到环境「${env.name}」（同名键已覆盖）`);
        },
      }
    );
  };

  const parsedDebugResponseJson = useMemo(() => {
    const t = debugResult?.responseBody?.trim();
    if (!t) return null;
    try {
      return JSON.parse(t) as unknown;
    } catch {
      return null;
    }
  }, [debugResult?.responseBody]);

  const debugResolvedRequestText = useMemo(() => {
    if (!debugResult) return "";
    const h = (debugResult.requestHeadersMasked ?? "").trim() || "（无）";
    const b = (debugResult.requestBodyMasked ?? "").trim() || "（无）";
    return `${debugResult.requestMethod} ${debugResult.requestUrl}\n\n请求头:\n${h}\n\n请求体:\n${b}`;
  }, [debugResult]);

'''

def main() -> None:
    root = pathlib.Path(__file__).resolve().parents[1]
    src_path = root / "src" / "pages" / "ApiRegressionEndpoints.tsx"
    lines = src_path.read_text(encoding="utf-8").splitlines()
    modal = "\n".join(lines[502:951])
    modal = modal.replace(
        """        onCancel={() => {
          setDebugOpen(false);
          setDebugEp(null);
          setDebugResult(null);
        }}""",
        "        onCancel={onClose}",
    )
    modal = modal.replace("debugEp", "localEp")
    modal = modal.replace("open={debugOpen}", "open={open}")
    out_path = root / "src" / "components" / "EndpointDebugModal.tsx"
    out_path.write_text(header + modal + "\n}\n", encoding="utf-8")
    print("Wrote", out_path, "lines", len((header + modal).splitlines()) + 1)


if __name__ == "__main__":
    main()
