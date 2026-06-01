package com.invmap.pickup;

/**
 * 车辆参数，用于通行规则过滤与配载。
 * height 车高(m)、weight 车货总重(t，限重判断)、width 车宽(m)、length 车长(m)、
 * turnRadius 最小转弯半径(m)、maxPayload 最大载货(t，整车载重上限判断)。
 */
public record Vehicle(
        String id, String name,
        double height, double weight,
        double width, double length,
        double turnRadius, double maxPayload
) {}
