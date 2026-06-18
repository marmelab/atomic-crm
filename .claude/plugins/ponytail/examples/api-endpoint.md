# API Endpoint

**Task:** "Add an endpoint that returns a user by id."

## Without Ponytail

```
app/
├── controllers/user_controller.py
├── services/user_service.py
├── repositories/user_repository.py
├── schemas/user_schemas.py
└── exceptions/user_exceptions.py
```

```python
# schemas/user_schemas.py
class UserResponseDTO(BaseModel):
    id: int
    name: str
    email: str

# repositories/user_repository.py
class UserRepository:
    def __init__(self, db: Session):
        self.db = db
    def find_by_id(self, user_id: int) -> User | None:
        return self.db.get(User, user_id)

# services/user_service.py
class UserService:
    def __init__(self, repo: UserRepository):
        self.repo = repo
    def get_user(self, user_id: int) -> User:
        user = self.repo.find_by_id(user_id)
        if user is None:
            raise UserNotFoundError(user_id)
        return user

# controllers/user_controller.py
@router.get("/users/{user_id}", response_model=UserResponseDTO)
def get_user(user_id: int, service: UserService = Depends(get_user_service)):
    try:
        return service.get_user(user_id)
    except UserNotFoundError:
        raise HTTPException(status_code=404, detail="User not found")
```

Five files, three classes, a custom exception, and a dependency-injection chain, wrapping one database call.

## With Ponytail

```python
# ponytail: drop the layers; keep the response schema, it whitelists what leaves the API
class UserOut(BaseModel):
    id: int
    name: str
    email: str

@app.get("/users/{user_id}", response_model=UserOut)
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404)
    return user
```

**5 files → 9 lines.** The repository, service, and custom exception were ceremony. The response schema was not: it whitelists which fields leave the API, so it stays. Returning the raw ORM model (`return user`) would leak every column, including the ones you never meant to expose. That is the line ponytail draws, and it is the same one the skill draws in "when NOT to be lazy": cut the layers, keep the trust boundary. Add a service layer when a second caller shows up, if it ever does.
