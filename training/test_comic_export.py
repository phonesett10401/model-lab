"""The exported ONNX must give the same boxes as the trained model. Run: python test_comic_export.py"""
from comic_export import boxes_match

a = [(0, 0.90, [10, 10, 100, 50]), (2, 0.60, [300, 40, 80, 80]), (1, 0.05, [5, 5, 5, 5])]
assert boxes_match(a, a)
assert boxes_match(a, [(0, 0.905, [10.2, 10, 100, 50]), (2, 0.60, [300, 40, 80, 80])]), 'tiny float differences are fine; low scores ignored'
assert not boxes_match(a, [(0, 0.90, [10, 10, 100, 50])]), 'a missing box fails'
assert not boxes_match(a, [(1, 0.90, [10, 10, 100, 50]), (2, 0.60, [300, 40, 80, 80])]), 'a changed class fails'
assert not boxes_match(a, [(0, 0.80, [10, 10, 100, 50]), (2, 0.60, [300, 40, 80, 80])]), 'a changed score fails'
assert not boxes_match(a, [(0, 0.90, [30, 10, 100, 50]), (2, 0.60, [300, 40, 80, 80])]), 'a moved box fails'
# half-size storage: big float weights are kept as float16 and cast back to float32 inside the model, so the browser
# computes in float32 as before; small ones stay float32; the outputs barely change
import numpy as np
import onnx
from onnx import helper, numpy_helper, TensorProto
from comic_export import weights_fp16
w = np.random.default_rng(0).standard_normal((64, 64)).astype(np.float32)
b = np.ones(4, np.float32)
g = helper.make_graph([helper.make_node('MatMul', ['x', 'W'], ['y'])], 'g',
                      [helper.make_tensor_value_info('x', TensorProto.FLOAT, [1, 64])], [helper.make_tensor_value_info('y', TensorProto.FLOAT, [1, 64])],
                      [numpy_helper.from_array(w, 'W'), numpy_helper.from_array(b, 'small')])
m = weights_fp16(helper.make_model(g, opset_imports=[helper.make_opsetid('', 17)], ir_version=8))
inits = {i.name: i.data_type for i in m.graph.initializer}
assert inits == {'W_fp16': TensorProto.FLOAT16, 'small': TensorProto.FLOAT}, inits
onnx.checker.check_model(m)
import onnxruntime as ort
x = np.random.default_rng(1).standard_normal((1, 64)).astype(np.float32)
y = ort.InferenceSession(m.SerializeToString(), providers=['CPUExecutionProvider']).run(None, {'x': x})[0]
assert y.dtype == np.float32 and np.abs(y - x @ w).max() < 0.05, np.abs(y - x @ w).max()
# a model that also lists its weights as inputs (older exports) stays valid: the renamed weight leaves the input list
g2 = helper.make_graph([helper.make_node('MatMul', ['x', 'W'], ['y'])], 'g2',
                       [helper.make_tensor_value_info('x', TensorProto.FLOAT, [1, 64]), helper.make_tensor_value_info('W', TensorProto.FLOAT, [64, 64])],
                       [helper.make_tensor_value_info('y', TensorProto.FLOAT, [1, 64])], [numpy_helper.from_array(w, 'W')])
m2 = weights_fp16(helper.make_model(g2, opset_imports=[helper.make_opsetid('', 17)], ir_version=8))
assert [i.name for i in m2.graph.input] == ['x'], [i.name for i in m2.graph.input]
y2 = ort.InferenceSession(m2.SerializeToString(), providers=['CPUExecutionProvider']).run(None, {'x': x})[0]
assert np.abs(y2 - x @ w).max() < 0.05
print('comic export checks passed')
