from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models import UserRole
from app.schemas.common import ORMModel


class UserOut(ORMModel):
    id: int
    email: str
    full_name: str
    role: UserRole
    is_active: bool
    created_at: datetime


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=2, max_length=150)

    @field_validator("email")
    @classmethod
    def lower_email(cls, v: str) -> str:
        return v.lower()


class LoginIn(BaseModel):
    email: EmailStr
    password: str

    @field_validator("email")
    @classmethod
    def lower_email(cls, v: str) -> str:
        return v.lower()


class RefreshIn(BaseModel):
    refresh_token: str


class AuthOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserOut


class ForgotPasswordIn(BaseModel):
    email: EmailStr


class ResetPasswordIn(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


class ProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=150)
    email: EmailStr | None = None

    @field_validator("email")
    @classmethod
    def lower_email(cls, v: str | None) -> str | None:
        return v.lower() if v else v


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class AddressIn(BaseModel):
    label: str = Field(default="Domicile", max_length=60)
    line1: str = Field(min_length=3, max_length=200)
    line2: str | None = Field(default=None, max_length=200)
    city: str = Field(min_length=1, max_length=100)
    postal_code: str = Field(min_length=1, max_length=20)
    country: str = Field(min_length=2, max_length=80)
    is_default: bool = False


class AddressOut(AddressIn, ORMModel):
    id: int


class AdminUserUpdate(BaseModel):
    role: UserRole | None = None
    is_active: bool | None = None
