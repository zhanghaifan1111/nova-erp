import React from 'react'
import OrderPage from './OrderPage'

export default function SalesOrders() {
  return <OrderPage
    collection="salesOrders"
    title="销售订单"
    desc="管理客户销售订单，跟踪发货与回款状态"
    partyLabel="客户"
    partyCollection="customers"
    statuses={['待付款', '待发货', '已发货', '已完成', '已取消']}
    noPrefix="SO"
  />
}
