package com.invmap.web;

/** 打印日志（用于回写 ERP 核销）。type: PICKUP|SETTLEMENT；paper: a4|receipt80。 */
public record PrintLog(
        String type,
        String code,      // 提货码/提货单号/车次号
        String billNo,
        Integer copies,
        String paper,
        String operator,
        String at
) {}
