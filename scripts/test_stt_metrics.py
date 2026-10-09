import unittest
import tempfile
import wave
from pathlib import Path
import importlib.util
spec = importlib.util.spec_from_file_location("stt", Path(__file__).with_name("verify-stt.py"))
stt = importlib.util.module_from_spec(spec)
spec.loader.exec_module(stt)

class MetricsTests(unittest.TestCase):
    def test_normalization(self):
        self.assertEqual(stt.normalize("가 나, 12!"), "가나12")
    def test_nfd(self):
        self.assertEqual(stt.normalize("가"), "가")
    def test_identical(self):
        self.assertEqual(stt.metrics("가나", "가 나.", [])["cer"], 0)
    def test_substitution(self):
        self.assertEqual(stt.distance("가나", "가다"), 1)
    def test_insert_delete(self):
        self.assertEqual(stt.distance("가나", "가"), 1)
        self.assertEqual(stt.distance("가", "가나"), 1)
    def test_empty_reference(self):
        self.assertIsNone(stt.metrics("", "환각", [])["cer"])
    def test_negation(self):
        self.assertFalse(stt.metrics("맡지 않겠습니다", "맡겠습니다", ["않겠습니다"])["keywords"]["않겠습니다"])
    def test_numbers_not_equated(self):
        self.assertGreater(stt.metrics("십월", "10월", [])["cer"], 0)

class SemanticTests(unittest.TestCase):
    def test_equivalent_date(self):
        self.assertTrue(stt.semantic_checks("십월 십이일", "10월 12일")["dateValues"])
    def test_wrong_date(self):
        self.assertFalse(stt.semantic_checks("십월 십이일", "10월 13일")["dateValues"])
    def test_missing_date(self):
        self.assertFalse(stt.semantic_checks("십월 십이일", "")["dateValues"])
    def test_extra_date(self):
        self.assertFalse(stt.semantic_checks("십월 십이일", "10월 12일 또는 10월 13일")["dateValues"])
    def test_no_date(self):
        self.assertIsNone(stt.semantic_checks("회의", "회의")["dateValues"])
    def test_invalid_date(self):
        self.assertEqual(stt.date_values("13월 32일"), [])
    def test_negation_typo(self):
        self.assertFalse(stt.semantic_checks("맡지 않겠습니다", "맞지 않겠습니다")["criticalTerms"]["맡지"])
    def test_term_typo(self):
        self.assertFalse(stt.semantic_checks("기한은", "기아는")["criticalTerms"]["기한은"])
    def test_name_typo(self):
        self.assertFalse(stt.semantic_checks("준호", "중호")["criticalTerms"]["준호"])

class PCMTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name) / "sample.wav"
    def make_wav(self, channels=1, width=2, rate=16000, data=bytes(32)):
        with wave.open(str(self.path), "wb") as f:
            f.setnchannels(channels)
            f.setsampwidth(width)
            f.setframerate(rate)
            f.writeframes(data)
    def test_valid(self):
        self.make_wav(data=bytes([0, 128, 255, 127]))
        samples = stt.read_pcm(self.path)
        self.assertEqual(len(samples), 2)
        self.assertEqual(float(samples[0]), -1.0)
        self.assertLess(float(samples[1]), 1.0)
    def test_empty(self):
        self.make_wav(data=b"")
        with self.assertRaisesRegex(ValueError, "Empty"):
            stt.read_pcm(self.path)
    def test_wrong_format(self):
        for options in ({"channels": 2}, {"width": 1}, {"rate": 8000}):
            with self.subTest(options=options):
                self.make_wav(**options)
                with self.assertRaisesRegex(ValueError, "Expected"):
                    stt.read_pcm(self.path)
    def test_truncated(self):
        self.make_wav()
        self.path.write_bytes(self.path.read_bytes()[:-2])
        with self.assertRaisesRegex(ValueError, "Truncated"):
            stt.read_pcm(self.path)
    def test_non_wav(self):
        self.path.write_bytes(b"not an audio file")
        with self.assertRaises((wave.Error, EOFError)):
            stt.read_pcm(self.path)
    def test_zero_byte(self):
        self.path.write_bytes(b"")
        with self.assertRaises((wave.Error, EOFError)):
            stt.read_pcm(self.path)
    def test_missing(self):
        with self.assertRaises(FileNotFoundError):
            stt.read_pcm(self.path)

if __name__ == "__main__":
    unittest.main()
