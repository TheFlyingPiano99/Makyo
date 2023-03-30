#pragma once
#include <string>

namespace Hogra {

	class AbstractUniformVariable {
	public:
		AbstractUniformVariable() = default;
		virtual ~AbstractUniformVariable() = default;
		virtual void Bind(unsigned int id) = 0;
		virtual std::string_view GetName() const = 0;
	};

}
