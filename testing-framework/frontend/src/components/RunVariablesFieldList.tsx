import { Button, Card, Form, Input, Space } from "antd";
import { PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import { emptyRunVarRow, type RunVarFormRow } from "../utils/runVariablesForm";

type Props = {
  /** Form.List 字段名，默认 runVarList */
  listName?: string;
  /** 单行「合并到环境」：参数为 Form.List 行下标 */
  onMergeRowToEnvironment?: (fieldIndex: number) => void;
  /** 正在合并的行下标（用于 loading），与 onMergeRowToEnvironment 成对使用 */
  mergeRowLoadingIndex?: number | null;
};

/**
 * 运行变量：键值表格（与调试断言同为 Form.List + Card 行）。
 */
export function RunVariablesFieldList({
  listName = "runVarList",
  onMergeRowToEnvironment,
  mergeRowLoadingIndex = null,
}: Props) {
  return (
    <Form.List name={listName}>
      {(fields, { add, remove }) => (
        <Space direction="vertical" size={10} style={{ width: "100%" }}>
          {fields.map(({ key, name, ...restField }) => (
            <Card
              key={key}
              size="small"
              bodyStyle={{ padding: "10px 12px" }}
              style={{ background: "rgba(0,0,0,0.15)", borderColor: "rgba(148,163,184,0.25)" }}
            >
              <Space wrap align="end" style={{ width: "100%" }}>
                <Form.Item
                  {...restField}
                  name={[name, "varName"]}
                  label="变量名"
                  rules={[
                    {
                      validator: async (_, v) => {
                        const s = String(v ?? "").trim();
                        if (!s) return Promise.resolve();
                        if (!/^\w+$/.test(s)) {
                          return Promise.reject(new Error("仅字母数字下划线"));
                        }
                        return Promise.resolve();
                      },
                    },
                  ]}
                  style={{ marginBottom: 0, minWidth: 140 }}
                >
                  <Input placeholder="email" autoComplete="off" />
                </Form.Item>
                <Form.Item
                  {...restField}
                  name={[name, "varValue"]}
                  label="值"
                  style={{ marginBottom: 0, flex: 1, minWidth: 200 }}
                >
                  <Input placeholder="159@qq.com 或内置占位见说明" autoComplete="off" />
                </Form.Item>
                <Form.Item label=" " colon={false} style={{ marginBottom: 0, flexShrink: 0 }}>
                  <Space size={0} wrap align="center">
                    {onMergeRowToEnvironment ? (
                      <Button
                        type="link"
                        size="small"
                        loading={mergeRowLoadingIndex === name}
                        onClick={() => onMergeRowToEnvironment(name)}
                      >
                        合并此项到环境
                      </Button>
                    ) : null}
                    <Button danger type="text" size="small" icon={<DeleteOutlined />} onClick={() => remove(name)}>
                      删除
                    </Button>
                  </Space>
                </Form.Item>
              </Space>
            </Card>
          ))}
          <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add(emptyRunVarRow() as RunVarFormRow)}>
            添加变量
          </Button>
        </Space>
      )}
    </Form.List>
  );
}
