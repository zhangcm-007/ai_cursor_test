import { useMemo } from "react";
import { Button, Space, Typography } from "antd";
import type { FormInstance } from "antd/es/form";
import { appendAssertionToDebugForm } from "../utils/debugAssertions";
import { collectJsonAssertSuggestions } from "../utils/jsonPathAssert";

/**
 * 根据响应 JSON 生成一键追加断言按钮（不再在正文上点击）。
 */
export function JsonResponseAssertButtons({
  data,
  form,
}: {
  data: unknown;
  form: FormInstance;
}) {
  const suggestions = useMemo(() => collectJsonAssertSuggestions(data), [data]);

  if (suggestions.length === 0) {
    return (
      <Typography.Text type="secondary" style={{ display: "block", marginTop: 8, fontSize: 12 }}>
        当前 JSON 无可用叶子字段，可在上方「断言」中手动添加。
      </Typography.Text>
    );
  }

  return (
    <div style={{ marginTop: 12 }}>
      <Typography.Text type="secondary" style={{ display: "block", marginBottom: 8, fontSize: 12 }}>
        一键追加断言（jsonpath_equals / 部分 jsonpath_exists），点击按钮写入下方断言列表。
      </Typography.Text>
      <Space wrap size={[8, 8]}>
        {suggestions.map((s) => (
          <Button
            key={s.key}
            size="small"
            type="dashed"
            title={JSON.stringify(s.assert)}
            onClick={() => appendAssertionToDebugForm(form, s.assert)}
          >
            {s.label}
          </Button>
        ))}
      </Space>
    </div>
  );
}
