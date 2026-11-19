import React from 'react'
import OrderPage from './OrderPage'

export default function PurchaseOrders() {
  return <OrderPage
    collection="purchaseOrders"
    title="采购订单"
    desc="管理供应商采购订单，跟踪到货与付款状态"
    partyLabel="供应商"
    partyCollection="suppliers"
    statuses={['待付款', '待收货', '已完成', '已取消']}
    noPrefix="PO"
  />
}
