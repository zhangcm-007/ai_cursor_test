"""Add password to environment variables"""
import json, sqlite3

db = sqlite3.connect(r"d:\ai_code\testing-framework\backend_python\data\python.db")
db.row_factory = sqlite3.Row

env = db.execute("SELECT id, name, variables FROM ApiEnvironment").fetchone()
vars_dict = json.loads(env["variables"] or "{}")

print("Current env variables:", json.dumps(vars_dict, ensure_ascii=False, indent=2))

# Add password (encrypted value)
vars_dict["password"] = "2pSO2UDNzITMhFEQ6llJ"

new_vars = json.dumps(vars_dict, ensure_ascii=False)
db.execute("UPDATE ApiEnvironment SET variables=? WHERE id=?", (new_vars, env["id"]))
db.commit()

print("\nUpdated env variables:", json.dumps(vars_dict, ensure_ascii=False, indent=2))

# Also update the collection definition step[1] to use {{password}}
col = db.execute("SELECT id, definition FROM ApiCollection WHERE id='bc93edc555529c58e5aa781e'").fetchone()
defn = json.loads(col["definition"])
steps = defn.get("steps", [])
for i, s in enumerate(steps):
    req = s.get("request", {})
    body = req.get("json")
    if isinstance(body, dict) and "password" in body:
        old_val = body["password"]
        body["password"] = "{{password}}"
        print(f"\nstep[{i}] password: {old_val} -> {{{{password}}}}")

defn["steps"] = steps
new_def = json.dumps(defn, ensure_ascii=False)
db.execute("UPDATE ApiCollection SET definition=? WHERE id=?", (new_def, col["id"]))
db.commit()
db.close()

print("\nDone!")
