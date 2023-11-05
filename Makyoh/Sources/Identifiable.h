#pragma once
#include <string>

namespace Hogra {
	class Identifiable
	{
	public:
		Identifiable();

		void SetId(unsigned int _id);

		unsigned int GetId() const;

		void SetName(std::string_view _name);

		std::string_view GetName() const;

	protected:
		uint32_t id;
		static uint32_t nextId;	// For generating new ids.
		std::string name = "";
	};
}

