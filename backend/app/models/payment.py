from pydantic import BaseModel, Field
from uuid import UUID
from typing import List


class CreateOrder(BaseModel):
    # Bounded so one request cannot ask the database to price ten thousand rows,
    # and so the Razorpay call stays a sane size.
    shortlist_ids: List[UUID] = Field(min_length=1, max_length=25)


class CreateOrderResponse(BaseModel):
    order_id: str
    amount: int  # paise
    currency: str
    key_id: str


class VerifyPayment(BaseModel):
    razorpay_order_id: str = Field(min_length=4, max_length=64)
    razorpay_payment_id: str = Field(min_length=4, max_length=64)
    razorpay_signature: str = Field(min_length=16, max_length=256)
