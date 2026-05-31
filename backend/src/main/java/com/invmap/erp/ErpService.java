package com.invmap.erp;

import com.invmap.pickup.OrdersData;

/**
 * ERP 提单数据源。真实对接时新增一个实现（调用 ERP 接口/数据库），
 * 通过配置切换即可替换 MockErpService。
 */
public interface ErpService {
    /** 按手机号查询待提提单；无数据返回 null。 */
    OrdersData getOrdersByPhone(String phone);
}
