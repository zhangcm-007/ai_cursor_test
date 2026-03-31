<?xml version="1.0" encoding="UTF-8"?>
<map version="1.0.1">
<node TEXT="语音03">
<node TEXT="TP-01 语音对话判断为复杂任务时，小窗口展示思考过程。">
</node>
<node TEXT="TP-02 小窗口展示子agent任务执行过程，内容可滑动但不可点击弹窗或展开收起。">
</node>
<node TEXT="TP-03 回答结束后，关闭思考过程小窗口，若有新语音进来则关闭cot弹窗。">
</node>
<node TEXT="TP-04 复杂任务判断结果触发等待语音说明，展示等待文案如：&apos;正在为您进行分析，请稍后&apos;。">
</node>
<node TEXT="TP-05 聊天记录详情展示思考过程，顶部展示思考过程入口，详情默认收起。">
</node>
<node TEXT="TP-06 点击思考过程展开按钮，展开展示思考过程详情。">
</node>
<node TEXT="TP-07 点击收起按钮，收起思考过程详情。">
</node>
<node TEXT="TP-08 思考过程未完成时暂停/结束语音对话，聊天界面不展示思考过程详情。">
</node>
<node TEXT="TP-09 思考过程已完成后暂停/结束语音对话，第一条回复消息顶部展示思考过程入口。">
</node>
<node TEXT="TP-10 思考过程小窗口内容最大可滑动到最后一条，验证滑动边界。">
</node>
<node TEXT="TP-11 子agent任务执行过程内容为空时，小窗口应正常显示或提示无内容。">
</node>
<node TEXT="TP-12 判断为非复杂任务时不展示思考过程小窗口。">
</node>
<node TEXT="TP-13 输入特殊字符或极长语音（如超出限制），系统应能正常判断复杂任务与否。">
</node>
<node TEXT="TP-14 思考过程小窗口未展示完内容，语音对话强制结束，cot弹窗是否正常关闭。">
</node>
<node TEXT="TP-15 思考过程详情内容包含异常格式或非法字符串时，详情展示应正常或给出提示。">
</node>
<node TEXT="TP-16 聊天记录中多条语音通话分别包含思考过程，详情入口优先展示最新的一条。">
</node>
<node TEXT="TP-17 新闻ticker_sentiment分析工具-筛选Ticker匹配且relevance_score&gt;0.5的数据条数。">
</node>
<node TEXT="TP-18 ticker_sentiment_score为1.5时，截断为1.0。为-1.2时，截断为-1.0。">
</node>
<node TEXT="TP-19 ticker_sentiment_score为刚好-1或1数据可正常通过截断约束。">
</node>
<node TEXT="TP-20 relevance_score边界值为0.5时数据是否被保留。">
</node>
<node TEXT="TP-21 没有ticker_sentiment_score字段时，工具应给出异常处理提示。">
</node>
<node TEXT="TP-22 无符合relevance_score&gt;0.5的新闻条时，返回空数据或提示。">
</node>
<node TEXT="TP-23 ticker_sentiment_score为空、非数值、超出范围时是否截断/异常提示。">
</node>
<node TEXT="TP-24 单条新闻情绪值统计公式正确，结果符合约束。">
</node>
<node TEXT="TP-25 多条新闻情绪值相关性加权处理公式S_daily正确，结果符合预期。">
</node>
<node TEXT="TP-26 整体区间内情绪值按权重衰减公式计算，时间越近权重越高。">
</node>
<node TEXT="TP-27 新闻数据跨多天，整体区间权重衰减效果明显。">
</node>
<node TEXT="TP-28 新闻时间格式非法或缺失时，整体情绪值计算需异常处理提示。">
</node>
<node TEXT="TP-29 情绪分析工具输入巨大数据量时（如上万条），性能无明显下降。">
</node>
<node TEXT="TP-30 工具输入ticker与数据中的ticker没有任何匹配时，结果为空或提示。">
</node>
</node>
</map>