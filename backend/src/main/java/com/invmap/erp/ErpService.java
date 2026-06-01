package com.invmap.erp;

import com.invmap.pickup.OrdersData;
import com.invmap.settlement.SettlementData;
import com.invmap.web.PrintLog;

/**
 * ERP 数据源。真实对接时新增实现（调用 ERP 接口/数据库），通过配置切换即可替换 MockErpService。
 */
public interface ErpService {
    /** 按手机号查询待提提单；无数据返回 null。 */
    OrdersData getOrdersByPhone(String phone);

    /** 按提货码或提货单号查询结算单；无数据返回 null。 */
    SettlementData getSettlement(String code);

    /** 按车次号查询并合并多提单结算单；无数据返回 null。 */
    SettlementData getTripSettlement(String tripCode);

    /** 打印日志回写 ERP（核销）。返回是否成功。 */
    boolean writeOff(PrintLog log);
}
