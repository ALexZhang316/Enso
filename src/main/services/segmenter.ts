/**
 * 中文分词工具模块。
 * 独立于 store / knowledge-service，避免循环依赖。
 */
import { Jieba } from "@node-rs/jieba";
import { dict } from "@node-rs/jieba/dict";

// jieba 单例：加载内置词典，整个进程只初始化一次
const jieba = Jieba.withDict(dict);

/** 判断字符串是否包含 CJK 统一表意文字 */
export const hasChinese = (text: string): boolean => /[\u4e00-\u9fa5]/.test(text);

/**
 * 对文本做 jieba 精确分词，词间用空格连接。
 * 英文/数字部分保持原样，只对中文部分做分词。
 * 用途：写入 FTS5 前预处理，让 unicode61 tokenizer 按空格切出中文词。
 */
export const segmentChinese = (text: string): string => {
  if (!hasChinese(text)) return text;
  // jieba.cut 精确模式，hmm=true 启用新词发现
  const words = jieba.cut(text, true);
  return words.join(" ");
};

/**
 * 用 jieba 分词提取中文词列表，用于查询端。
 * 返回去重后的词数组（不含停用词）。
 */
export const segmentTerms = (text: string): string[] => {
  const words = jieba.cut(text, true);
  return words.map((w) => w.trim()).filter((w) => w.length > 0);
};
