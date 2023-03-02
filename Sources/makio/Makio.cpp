#include "Makio.h"
#include "../AssetFolderPathManager.h"
#include "../GeometryFactory.h"
#include <glm/gtc/matrix_transform.hpp>
#include <glm/glm.hpp>
#include<glm/gtx/rotate_vector.hpp>
#include "../UniformVariableImpl.h"
#include "../GlobalInclude.h"
#include <glm/mat4x4.hpp>

namespace Hogra::MakioSim {

#define MAKIO_RENDER_RES_X 1024
#define MAKIO_RENDER_RES_Y 1024

		void MakioCanvas::Init(ShaderProgram* canvasRender)
		{
			auto* quad = GeometryFactory::GetInstance()->GetSimpleQuad();
			auto* canvasTexture = Allocator::New<Texture2D>();
			canvasTexture->Init(GL_RGBA16F, glm::ivec2(MAKIO_RENDER_RES_X, MAKIO_RENDER_RES_Y), 0, GL_RGBA, GL_FLOAT);
			canvasFBO.Init();
			canvasFBO.LinkTexture(GL_COLOR_ATTACHMENT0, *canvasTexture);
			auto* quadrantMaterial = Allocator::New<Material>();
			quadrantMaterial->Init(canvasRender);
			quadrantMaterial->SetAlphaBlend(false);
			quadrantMaterial->SetName("QuadrantMaterial");
			quadrant.Init(quadrantMaterial, quad);
			quadrant.SetDepthTest(false);
			quadrant.SetName("QuadrantMesh");

			// Full screen quad mesh for combine scene with volume:
			auto* combineProgram = Allocator::New<ShaderProgram>();
			combineProgram->Init(
				AssetFolderPathManager::getInstance()->getShaderFolderPath().append("single2D.vert"),
				"",
				AssetFolderPathManager::getInstance()->getShaderFolderPath().append("makioToScreen.frag")
			);

			auto* material = Allocator::New<Material>();
			material->Init(combineProgram);
			material->AddTexture(canvasTexture);
			material->SetAlphaBlend(true);
			material->SetBlendFunc(GL_ONE, GL_ONE_MINUS_SRC_ALPHA);
			fullScreenQuad.Init(material, quad);
			fullScreenQuad.SetDepthTest(false);
			fullScreenQuad.SetName("FullScreenQuadMesh");

			quadrantCount = glm::ivec2(64, 64);
			nextQuadrantToRender = glm::ivec2(0, 0);
		}

		void MakioCanvas::Draw(FBO& outFBO, const Texture2D& depthTexture, const Camera& camera)
		{
			if (!finishedRender) {

				// Draw itnernally:
				canvasFBO.Bind();
				quadrant.Bind();

				glm::mat4 quadModelMatrix;
				if (drawFullCanvas) {
					quadModelMatrix = glm::mat4(1.0f);
				}
				else {
					quadModelMatrix =
						glm::translate(
							glm::vec3(2.0f / (float)quadrantCount.x, 2.0f / (float)quadrantCount.y, 0.0f) * glm::vec3(nextQuadrantToRender.x, nextQuadrantToRender.y, 0.0f)
							- glm::vec3(1.0f - 1.0f / (float)quadrantCount.x, 1.0f - 1.0f / (float)quadrantCount.y, 0.0f))
						* glm::scale(glm::vec3(1.0f / (float)quadrantCount.x, 1.0f / (float)quadrantCount.y, 1.0f));
				}
				quadrant.getMaterial()->GetShaderProgram()->SetUniform("quadModelMatrix", quadModelMatrix);

				quadrant.Draw();

				if (nextQuadrantToRender.x < quadrantCount.x - 1) {
					nextQuadrantToRender.x++;
				}
				else {
					nextQuadrantToRender.x = 0;
					if (nextQuadrantToRender.y < quadrantCount.y - 1) {
						nextQuadrantToRender.y++;
					}
					else {
						nextQuadrantToRender.y = 0;
						finishedRender = true;
					}
				}
			}

			// Draw on screen:
			outFBO.Bind();
			fullScreenQuad.Bind();
			glm::mat4 transform = 
				glm::ortho(0.0f, (float)GlobalVariables::windowWidth, 0.0f, (float)GlobalVariables::windowHeight)
				* glm::translate(glm::vec3((float)GlobalVariables::windowWidth / 2.0f, (float)GlobalVariables::windowHeight / 2.0f, 0)) 
				* glm::scale(glm::vec3(300, 300, 1));
			fullScreenQuad.getMaterial()->GetShaderProgram()->SetUniform("transform", transform);

			fullScreenQuad.Draw();
			outFBO.Unbind();
		}
	}
