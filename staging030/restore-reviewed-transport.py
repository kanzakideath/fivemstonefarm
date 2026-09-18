from pathlib import Path
import hashlib
p=Path("staging030/finish.0.b64")
s=p.read_text(encoding="utf-8-sig").strip()
assert hashlib.sha256(s.encode()).hexdigest()=='a537aa8d7b86787fc1a165298135b61de44fe9bfaa73c5bcd1f5b63e7cb7bc68'
rep=[[3787, 3787, '3s492Xv1me/O97c1/0r/X5FSRdbNxwlpIyo2WOW8jqcqKgWhAhRAQgvwzLUty2oOE/FUeVhm5pXwsj5lO03IMgT8soyrs8RT2oMEEpwdzObZ04T+QQC5IMFjAZY1vGh2tmcCBk2wjI1U8Rfovm0wVHwR6Ufjb6hm9ZlZwgdB75q4OYEyvl8yFltVyAEkSepDFp52I1Z96/jswVBjAegv18SQIG6kUILCjehOtO4YchXzknckL2J+GkgCWKO6DjbZcK1niSOMj0HAqpTJrVS5uAMDeUFm9p4y1EQ2WiI2/DmpeYYrX0wiIYhwNwqSDAmW5LuhtSZl3Mt9q6MtARCgK2ukAeS3HnQHNIgLREGCIg7UM5lPFXRzRenDVltXjhrmw6I5ohd4ckDyIUwfUAS0Jv1JTIFLVKbOR5N8oovbjam+qGMSuIAeOWtyx9qgFvn4mzVvIFjLYfLYATT2bFs35pfiH/kkpPYUc/n8qtY8J8McXmIcAI3gEAhJzNwNKJpD4/+X0lA7T08FOCP2/k9C4CDkQEGjA1hwXOWiG1xt1eVOjVFwEoqO/JMgHBkB1Sw8c3luBY/QclMf0MG25Ztm4eJF1gerRxYtNTrnMiwETBV3CrC+A4CJRgt/NQ7Gs8JpPyKj9yUNyE3eXQYzMW/Z8g1oGKRRsgEnaDR8gj0B9yFLrjmE0UAiw2s1F3QEMghFUA9tpARAH2HZwC/T+99/tvPH7ndc+27n1wfbW1r2v3iepCNLv8'], [8765, 8766, '']]
for a,b,v in reversed(rep): s=s[:a]+v+s[b:]
assert len(s)==14000
assert hashlib.sha256(s.encode()).hexdigest()=='9f32411b7474007b037ec2706f448b97f41bb53ead8ab8e41cff9f0a49300e73'
p.write_text(s,encoding="utf-8")
