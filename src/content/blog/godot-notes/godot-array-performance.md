---
title: "Godot Array는 왜 앞에서 빼면 느릴까 — std::vector와 pop_front()의 함정"
description: "Godot의 Array가 C++ std::vector 기반으로 구현된 이유와, pop_front() / remove_at(0)가 성능에 미치는 영향을 실측 데이터와 함께 정리한다."
pubDate: 2026-07-01
tags: ["Godot", "GDScript", "Performance", "Data Structure"]
draft: false
---

## 시작하며

오브젝트 풀(Object Pool)이나 큐 형태의 로직을 GDScript로 짜다 보면 자연스럽게 이런 코드를 쓰게 된다.

```gdscript
var item = _pool[0]
_pool.remove_at(0)
```

배열의 맨 앞 요소를 꺼내 쓰고 지우는, 아주 흔한 패턴이다. 하지만 이 코드는 풀에 담긴 요소 수가 많아질수록 눈에 띄게 느려진다. 이유는 Godot의 `Array`가 내부적으로 어떻게 구현되어 있는지를 보면 명확해진다.

## Array는 std::vector 기반이다

Godot의 `Array`는 C++ 엔진 코어에서 `Vector<Variant>`를 감싸는 형태로 구현되어 있다. 이름 그대로 연속된 메모리 블록에 요소를 순서대로 저장하는 구조이며, 개념적으로 C++의 `std::vector`와 동일한 특성을 가진다.

이 구조에서 핵심은 다음과 같다.

- 요소들은 메모리상 **연속**으로 배치된다.
- 끝(back)에 요소를 추가/제거하는 것은 메모리 재배치가 필요 없다 → **O(1)**
- 앞(front)이나 중간에서 요소를 추가/제거하면, 그 뒤에 있는 모든 요소를 한 칸씩 밀거나 당겨야 한다 → **O(n)**

즉 `push_back()` / `pop_back()`은 상수 시간이지만, `push_front()` / `pop_front()` / `remove_at(0)`은 배열 크기에 비례해 느려진다.

## 실측 데이터

이건 이론만이 아니라 실제로 벤치마크된 내용이다. Godot 엔진 공식 이슈 트래커에는 배열 크기 1,000개 기준으로 `pop_front()`가 `pop_back()`보다 수십~수백 배 느리다는 리포트가 등록되어 있고, 1,000개 요소에서 `pop_front()` 호출이 수 밀리초 단위로 걸리는 것으로 측정되었다. 요소가 하나씩 늘어날수록 이 차이는 더 벌어진다.

GDQuest의 GDScript 최적화 가이드에서도 같은 이유로 이렇게 권장한다.

> 배열의 특정 위치에서 요소를 추가하거나 제거할 때마다 Godot은 배열 크기를 조정하고 요소들을 이동시켜야 하며, 이 비용은 배열에 담긴 요소 수에 비례한다. 제거되는 요소가 마지막 요소일 때만 엔진은 단순히 크기를 줄이기만 하면 된다.

정리하면 다음과 같다.

| 연산 | 시간 복잡도 | 비고 |
|---|---|---|
| `append()` / `push_back()` | O(1) | 끝에 추가 |
| `pop_back()` | O(1) | 끝에서 제거 |
| `push_front()` | O(n) | 전체 요소 시프트 |
| `pop_front()` | O(n) | 전체 요소 시프트 |
| `remove_at(0)` | O(n) | 앞쪽 제거는 항상 시프트 발생 |

## 그래서 어떻게 써야 하나

기본 원칙은 하나다. **배열을 스택(LIFO)처럼 쓴다.**

```gdscript
# Good — O(1)
_pool.append(item)      # push_back
var item = _pool.pop_back()

# Bad — O(n), 요소가 많아질수록 느려짐
_pool.push_front(item)
var item = _pool.pop_front()
```

오브젝트 풀처럼 "어떤 요소를 꺼내든 상관없는" 상황에서는 순서를 지킬 이유가 없으므로 항상 뒤에서 꺼내고 뒤에 반환하면 된다. 즉 LIFO로 다뤄도 로직상 전혀 문제가 되지 않으면서 성능은 최선을 얻을 수 있다.

만약 순서(FIFO)가 반드시 필요한 큐 로직이라면 `Array`보다 다른 구조를 고려하는 편이 낫다. 예를 들어 인덱스 두 개(head, tail)를 직접 관리하는 링 버퍼(ring buffer)를 구현하거나, 제거 순서가 중요하지 않은 경우 마지막 요소와 스왑한 뒤 `pop_back()`하는 "swap-and-pop" 트릭으로 O(1) 제거를 흉내낼 수 있다.

```gdscript
# 순서 무관, O(1) 제거가 필요할 때의 swap-and-pop
func remove_unordered(arr: Array, index: int) -> void:
    arr[index] = arr[-1]
    arr.pop_back()
```

## 정리

- Godot `Array`는 C++ `std::vector` 기반 연속 메모리 구조다.
- 끝에서의 추가/제거는 O(1), 앞에서의 추가/제거는 O(n)이다.
- 오브젝트 풀처럼 순서가 중요하지 않은 컬렉션은 **항상 `push_back()` / `pop_back()`으로 스택처럼 다루는 것**이 정답이다.
- 순서가 꼭 필요한 큐라면 `Array`를 그대로 쓰기보다 링 버퍼 등 다른 구조를 고려하자.

## 참고

- [Godot Engine Issue #45455 — Array.pop_front is 100 times slower than Array.pop_back](https://github.com/godotengine/godot/issues/45455)
- [GDQuest — Optimizing GDScript code](https://www.gdquest.com/tutorial/godot/gdscript/optimization-code/)
