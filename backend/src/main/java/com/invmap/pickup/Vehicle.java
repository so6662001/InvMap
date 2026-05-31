package com.invmap.pickup;

/** 车辆（车高 m、车货总重 t），用于按限高/限重过滤道路。 */
public record Vehicle(String id, String name, double height, double weight) {}
