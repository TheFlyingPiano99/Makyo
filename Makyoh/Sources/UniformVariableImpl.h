#pragma once
#include "UniformVariable.h"
#include <string>

namespace Hogra {
	template<typename T>
	class UniformVariable : public AbstractUniformVariable
	{
	public:
		UniformVariable() = default;

		void Init(std::string_view _key, const T& _val) {
			key = _key;
			value = _val;
		}

		void Bind(unsigned int id) override;

		void Set(const T val);

		const T Get();

		std::string_view GetName() const override {
			return key;
		}

	private:
		std::string key;
		T value;
	};
}
