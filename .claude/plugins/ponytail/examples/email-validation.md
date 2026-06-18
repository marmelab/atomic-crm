# Email Validation

**Task:** "Validate an email address in Python."

## Without Ponytail

```python
import re

EMAIL_PATTERN = re.compile(
    r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
)

class EmailValidator:
    """Validates email addresses against RFC-like rules."""

    def __init__(self, pattern: re.Pattern = EMAIL_PATTERN):
        self.pattern = pattern

    def validate(self, email: str) -> bool:
        if not isinstance(email, str):
            raise TypeError("email must be a string")
        email = email.strip()
        if not email:
            return False
        return bool(self.pattern.match(email))


def validate_email(email: str) -> bool:
    """Convenience wrapper around EmailValidator."""
    return EmailValidator().validate(email)
```

A class, a wrapper, a regex that still rejects valid addresses and accepts invalid ones. Regex cannot validate email. Only a delivery attempt can.

## With Ponytail

```python
# ponytail: good enough, real validation is sending the mail
"@" in email and "." in email.split("@")[-1]
```

Or, if it must be thorough, the standard library has it:

```python
# ponytail: stdlib covers this
from email.utils import parseaddr
"@" in parseaddr(email)[1]
```

**27 lines → 1 line.** And the honest answer: let the confirmation email reject it. That's what confirmation emails are for.
