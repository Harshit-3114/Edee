from pydantic import BaseModel
from uuid import UUID
from typing import List


class CreateOrder(BaseModel):
    shortlist_ids: List[UUID]


class CreateOrderResponse(BaseModel):
    order_id: str
    amount: int
    currency: str
    key_id: str


class VerifyPayment(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str