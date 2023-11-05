#include "Identifiable.h"
namespace Hogra {

	uint32_t Identifiable::nextId = 0;
	
	Identifiable::Identifiable()
	{
		id = nextId++;
	}

	void Identifiable::SetId(unsigned int _id)
	{
		id = _id;
		if (nextId <= id) {
			nextId = id + 1;
		}
	}

	unsigned int Identifiable::GetId() const
	{
		return id;
	}

	void Identifiable::SetName(std::string_view _name) {
		name = _name;
	}

	std::string_view Identifiable::GetName() const {
		return name;
	}

}
