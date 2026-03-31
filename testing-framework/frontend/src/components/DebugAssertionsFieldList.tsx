import { Button, Card, Form, Input, Select, Space } from "antd";
import {
  DEBUG_ASSERT_TYPE_OPTIONS,
  defaultDebugAssertRow,
  type DebugAssertFormRow,
} from "../utils/debugAssertions";

type NamePath = number;

function AssertRowExtraFields({ name }: { name: NamePath }) {
  return (
    <Form.Item noStyle dependencies={[["assertList", name, "type"]]}>
      {({ getFieldValue }) => {
        const t = getFieldValue(["assertList", name, "type"]) as string;
        if (t === "status") {
          return (
            <Form.Item
              name={[name, "statusCode"]}
              label="期望状态码"
              rules={[{ required: true, message: "必填" }]}
              style={{ marginBottom: 0 }}
            >
              <Input placeholder="200" style={{ width: 100 }} />
            </Form.Item>
          );
        }
        if (t === "jsonpath_exists") {
          return (
            <Form.Item
              name={[name, "path"]}
              label="JSONPath"
              rules={[{ required: true, message: "必填" }]}
              style={{ marginBottom: 0, minWidth: 220, flex: 1 }}
            >
              <Input placeholder="$.data.code" />
            </Form.Item>
          );
        }
        if (t === "jsonpath_equals") {
          return (
            <Space wrap style={{ flex: 1 }}>
              <Form.Item
                name={[name, "path"]}
                label="JSONPath"
                rules={[{ required: true, message: "必填" }]}
                style={{ marginBottom: 0, minWidth: 200 }}
              >
                <Input placeholder="$.code" />
              </Form.Item>
              <Form.Item name={[name, "equals"]} label="期望值" style={{ marginBottom: 0, minWidth: 160, flex: 1 }}>
                <Input placeholder='0 或 "ok" 或 JSON' />
              </Form.Item>
            </Space>
          );
        }
        if (t === "header_contains") {
          return (
            <Space wrap style={{ flex: 1 }}>
              <Form.Item
                name={[name, "headerName"]}
                label="响应头名"
                rules={[{ required: true, message: "必填" }]}
                style={{ marginBottom: 0, minWidth: 140 }}
              >
                <Input placeholder="content-type" />
              </Form.Item>
              <Form.Item
                name={[name, "headerContains"]}
                label="包含文本"
                rules={[{ required: true, message: "必填" }]}
                style={{ marginBottom: 0, minWidth: 160, flex: 1 }}
              >
                <Input placeholder="json" />
              </Form.Item>
            </Space>
          );
        }
        if (t === "body_contains") {
          return (
            <Form.Item
              name={[name, "bodyContains"]}
              label="包含子串"
              rules={[{ required: true, message: "必填" }]}
              style={{ marginBottom: 0, flex: 1, minWidth: 200 }}
            >
              <Input placeholder="success" />
            </Form.Item>
          );
        }
        return null;
      }}
    </Form.Item>
  );
}

/**
 * 调试表单内「断言」列表（非 JSON 文本）。
 */
export function DebugAssertionsFieldList() {
  return (
    <Form.List name="assertList">
      {(fields, { add, remove }) => (
        <Space direction="vertical" size={10} style={{ width: "100%" }}>
          {fields.map(({ key, name, ...restField }) => (
            <Card
              key={key}
              size="small"
              bodyStyle={{ padding: "10px 12px" }}
              style={{ background: "rgba(0,0,0,0.15)", borderColor: "rgba(148,163,184,0.25)" }}
            >
              <Space wrap align="start" style={{ width: "100%" }}>
                <Form.Item
                  {...restField}
                  name={[name, "type"]}
                  label="断言类型"
                  rules={[{ required: true, message: "必选" }]}
                  style={{ marginBottom: 0 }}
                >
                  <Select style={{ width: 168 }} options={DEBUG_ASSERT_TYPE_OPTIONS} />
                </Form.Item>
                <AssertRowExtraFields name={name} />
                <Button danger type="link" size="small" onClick={() => remove(name)}>
                  删除
                </Button>
              </Space>
            </Card>
          ))}
          <Button type="dashed" block onClick={() => add(defaultDebugAssertRow() as DebugAssertFormRow)}>
            添加断言
          </Button>
        </Space>
      )}
    </Form.List>
  );
}
