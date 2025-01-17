import { DiceRoller } from "../component/dice-roller.js";
import { RollDialog } from "../app/roll-dialog.js";
import { onManageActiveEffect, prepareActiveEffectCategories } from '../helpers/effects.mjs'

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
export class MYZActorSheet extends ActorSheet {
    diceRoller = new DiceRoller();

    /* -------------------------------------------- */

    /** @override */
    async getData(options) {
        const source = this.actor.toObject();
        const actorData = this.actor.toObject(false);
        const context = {
            actor: actorData,
            source: source.system,
            system: actorData.system,
            items: actorData.items,
            effects: prepareActiveEffectCategories(this.actor.effects),
            owner: this.actor.isOwner,
            limited: this.actor.limited,
            options: this.options,
            editable: this.isEditable,
            type: this.actor.type,
            isCharacter: this.actor.type === "character",
            isNPC: this.actor.type === "npc",
            isVehicle: this.actor.type === "vehicle",
            rollData: this.actor.getRollData.bind(this.actor)
        }
        context.effects = prepareActiveEffectCategories(this.actor.effects);
        this._prepareCharacterItems(context);
        context.descriptionHTML = await TextEditor.enrichHTML(context.system.description, {
            secrets: this.actor.isOwner,
            async: true
        });
        return context;
    }

    /**
     * Organize and classify Items for Character sheets.
     * @param {Object} actorData The actor to prepare.
     * @return {undefined}
     */
    _prepareCharacterItems(context) {
        // Initialize containers.
        const skills = [];
        const talents = [];
        const secondary_functions = [];
        const abilities = [];
        const mutations = [];
        const animal_powers = [];
        const modules = [];
        const contacts = [];
        const weapons = [];
        const armor = [];
        const chassis = [];
        const gear = [];
        const artifacts = [];
        const criticals = [];

        // Iterate through items, allocating to containers
        // let totalWeight = 0;
        for (let i of context.items) {
            // let item = i.data;
            i.img = i.img || DEFAULT_TOKEN;
            // Append to gear.
            if (i.type === "skill") {
                skills.push(i);
            } else if (i.type === "talent") {
                talents.push(i);
            } else if (i.type === "secondary_function") {
                secondary_functions.push(i);
            } else if (i.type === "ability") {
                abilities.push(i);
            } else if (i.type === "mutation") {
                mutations.push(i);
            } else if (i.type === "animal_power") {
                animal_powers.push(i);
            } else if (i.type === "contact") {
                contacts.push(i);
            } else if (i.type === "module") {
                modules.push(i);
            } else if (i.type === "weapon") {
                weapons.push(i);
            } else if (i.type === "armor") {
                armor.push(i);
            } else if (i.type === "chassis") {
                chassis.push(i);
            } else if (i.type === "gear") {
                gear.push(i);
            } else if (i.type === "artifact") {
                artifacts.push(i);
            } else if (i.type === "critical") {
                criticals.push(i);
            }
        }
        //sort skills
        const sortedBy = {
            strength: 0,
            agility: 1,
            wits: 2,
            empathy: 3,
        };
        // sort skills by attribute
        skills.sort((a, b) => sortedBy[a.system.attribute] - sortedBy[b.system.attribute]);

        // sort skills alphabeticaly in attribute groups
        skills.sort((a, b)=> {
            if (a.system.attribute === b.system.attribute){
              return a.system.skillKey < b.system.skillKey ? -1 : 1
            } 
          })

        // Assign and return
        context.skills = skills;
        context.talents = talents;
        context.secondary_functions = secondary_functions;
        context.abilities = abilities;
        context.mutations = mutations;
        context.animal_powers = animal_powers;
        context.contacts = contacts;
        context.modules = modules;
        context.weapons = weapons;
        context.armor = armor;
        context.chassis = chassis;
        context.gear = gear;
        context.artifacts = artifacts;
        context.criticals = criticals;

        // pack inventory for NPCs
        if(context.actor.type=="npc"){
            context.npcInventory = [...gear, ...artifacts]
            if(context.system.creatureType=="mutant"){
                context.npcInventory = [...context.npcInventory, ...chassis]
            }else if(context.system.creatureType=="robot"){
                context.npcInventory = [...context.npcInventory, ...armor]
            }
            else if(context.system.creatureType=="animal"){
                context.npcInventory = [...context.npcInventory, ...chassis]
            }
            else if(context.system.creatureType=="human"){
                context.npcInventory = [...context.npcInventory, ...chassis]
            }
        }        
    }

    /* -------------------------------------------- */

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);

        // Everything below here is only needed if the sheet is editable
        if (!this.options.editable) return;

        // * Active Effect management
        html
            .find('.effect-control')
            .click((ev) => onManageActiveEffect(ev, this.actor))

        /* -------------------------------------------- */
        /* ROLL & PUSH BUTTONS
        /* -------------------------------------------- */

        html.find(".button-roll").click((ev) => {
            ev.preventDefault();
            let rollName = "MYZ.CUSTOM_ROLL";
            RollDialog.prepareRollDialog({
                rollName: rollName,
                diceRoller: this.diceRoller,
            });
        });

        html.find(".button-push").click((ev) => {
            ev.preventDefault();
            this.diceRoller.push({ actor: this.actor });
        });

        /* -------------------------------------------- */
        /* LISTEN VALUE CHANGING
        /* -------------------------------------------- */

        /* CHANGE SKILL VALUE */
        html.find(".skill-value").change(this._onChangeSkillValue.bind(this));

        /* ADD INVENTORY ITEM */
        html.find(".item-create").click(this._onItemCreate.bind(this));

        // UPDATE INVENTORY ITEM
        html.find(".item-edit").click((ev) => {
            const li = $(ev.currentTarget).parents(".box-item");
            const item = this.actor.items.get(li.data("item-id"));
            item.sheet.render(true);
        });

        // DELETE INVENTORY ITEM
        html.find(".item-delete").click((ev) => {
            const li = $(ev.currentTarget).parents(".box-item");
            this._deleteOwnedItemById(li.data("item-id"));
            li.slideUp(200, () => this.render(false));
        });

        //Toggle Equip Inventory Item
        html.find(".item-toggle").click(async (ev) => {
            const li = $(ev.currentTarget).parents(".box-item");
            const item = this.actor.items.get(li.data("item-id"));
            await this.actor.updateEmbeddedDocuments("Item", [this._toggleEquipped(li.data("item-id"), item)]);
        });

        //Toggle Stash Item
        html.find(".item-stash-toggle").click(async (ev) => {
            const li = $(ev.currentTarget).parents(".box-item");
            const item = this.actor.items.get(li.data("item-id"));
            await this.actor.updateEmbeddedDocuments("Item", [this._toggleStashed(li.data("item-id"), item)]);
        });

        // Toggle Broken Module
        html.find(".item-broken").click(async (ev) => {
            const li = $(ev.currentTarget).parents(".box-item");
            const item = this.actor.items.get(li.data("item-id"));
            await this.actor.updateEmbeddedDocuments("Item", [this._toggleBroken(li.data("item-id"), item)]);
        });

        /* CHANGE ITEM VALUE */
        html.find(".owned-item-value").change(this._onChangeOwnedItemValue.bind(this));

        /* -------------------------------------------- */
        /* LISTEN CLICKS
        /* -------------------------------------------- */

        // Roll Attribute
        html.find(".roll-attribute").click(this._onRollAttribute.bind(this));

        // Roll Skill
        html.find(".roll-skill").click(this._onRollSkill.bind(this));

        // Viewable Item
        html.find(".viewable").click(this._onItemView.bind(this));

        // Chatable Item
        html.find(".chatable").click(this._onItemSendToChat.bind(this));

        //Roll Rot
        html.find(".roll-rot").click((event) => {
            let rotTotal = parseInt(this.actor.system.rot.value) + parseInt(this.actor.system.rot.permanent);
            RollDialog.prepareRollDialog({
                rollName: game.i18n.localize("MYZ.ROT"),
                diceRoller: this.diceRoller,
                baseDefault: rotTotal,
            });
        });

        //Roll Weapon Item
        html.find(".roll-weapon").click((event) => {
            const itemId = $(event.currentTarget).data("item-id");
            const weapon = this.actor.items.get(itemId);
            let testName = weapon.name;
            let skill;
            if (weapon.system.category === "melee") {
                if (this.actor.system.creatureType != "robot") {
                    skill = this.actor.items.contents.find((i) => i.system.skillKey == "FIGHT");
                } else {
                    skill = this.actor.items.contents.find((i) => i.system.skillKey === "ASSAULT");
                }
            } else {
                skill = this.actor.items.contents.find((i) => i.system.skillKey == "SHOOT");
            }
            if (!skill) {
                skill = {
                    system: {
                        value: 0
                    }
                };
                if (weapon.system.category === "melee") {
                    skill.system.skillKey = this.actor.system.creatureType != "robot" ? "FIGHT" : "ASSAULT"
                    skill.system.attribute = "strength";
                } else {
                    skill.system.skillKey = "SHOOT"
                    skill.system.attribute = "agility";
                }
            }

            const diceTotals = this._getRollModifiers(skill)
            diceTotals.gearDiceTotal += parseInt(weapon.system.bonus.value);
            diceTotals.gearDiceTotal = Math.max(0, diceTotals.gearDiceTotal)

            const applyedModifiersInfo = this._getModifiersInfo(diceTotals)

            RollDialog.prepareRollDialog({
                rollName: testName,
                attributeName: skill.system.attribute,
                itemId,
                diceRoller: this.diceRoller,
                baseDefault: diceTotals.baseDiceTotal,
                skillDefault: diceTotals.skillDiceTotal,
                gearDefault: diceTotals.gearDiceTotal,
                modifierDefault: weapon.system.skillBonus,
                artifactDefault: weapon.system.artifactBonus || 0,
                damage: weapon.system.damage,
                applyedModifiers: applyedModifiersInfo,
                actor: this.actor,
                skillItem: skill
            });
        });

        //Roll Armor
        html.find(".armor-roll").click((event) => {
            RollDialog.prepareRollDialog({
                rollName: game.i18n.localize("MYZ.ARMOR"),
                diceRoller: this.diceRoller,
                gearDefault: this.actor.system.armorrating.value,
            });
        });

        //Roll Armor Item
        html.find(".armor-item-roll").click((event) => {
            const itemBox = $(event.currentTarget).parents(".box-item");
            const itemId = itemBox.data("item-id");
            const armorItem = this.actor.items.get(itemId);
            let testName = armorItem.name;
            RollDialog.prepareRollDialog({
                rollName: testName,
                diceRoller: this.diceRoller,
                gearDefault: armorItem.system.rating.value,
            });
        });

        //SET NPC creatureType
        html.find(".crature-picker").click(this._updateNPCCreatureType.bind(this));

        /* -------------------------------------------- */
        /* ADD LEFT CLICK CONTENT MENU
        /* -------------------------------------------- */
        const editLabel = game.i18n.localize("MYZ.EDIT");
        const deleteLabel = game.i18n.localize("MYZ.DELETE");
        const toChatLabel = game.i18n.localize("MYZ.TOCHAT");
        const stashLabel = game.i18n.localize("MYZ.STASH");
        const equipLabel = game.i18n.localize("MYZ.EQUIP");

        let menu_items = [
            {
                icon: `<i class="fas fa-comment" title="${toChatLabel}"></i>`,
                name: '',
                callback: (t) => {
                    this._onPostItem(t.data("item-id"));
                },
            },
            {
                icon: `<i class="fas fa-edit" title="${editLabel}"></i>`,
                name: '',
                callback: (t) => {
                    this._editOwnedItemById(t.data("item-id"));
                },
            },
            {
                icon: `<i class="fa-regular fa-box" title="${stashLabel}"></i>`,
                name: '',
                callback:async (t) => {
                    const item = this.actor.items.get(t.data("item-id"));
                    await this.actor.updateEmbeddedDocuments("Item", [this._toggleStashed(t.data("item-id"), item)]);
                },
                condition: (t) => {
                    if (t.data("physical")=="1") {
                        return true;
                    } else {
                        return false;
                    }
                },
            },
            {
                icon: `<i class="fas fa-trash" title="${deleteLabel}"></i>`,
                name: '',
                callback: (t) => {
                    this._deleteOwnedItemById(t.data("item-id"));
                }
            },
        ];

        new ContextMenu(html, ".editable-item", menu_items);
        //new ContextMenu(html.find(".editable-item"),  menu_items);

        // html.find(".editable-item").on( "contextmenu", function() {
        //     alert( "Handler for `contextmenu` called." );
        //   } );

        new ContextMenu(html, ".editable-armor", [            
            {
                icon: `<i class="fa-solid fa-shirt" title="${equipLabel}"></i>`,
                name: '',
                callback: async (t) => {
                    const item = this.actor.items.get(t.data("item-id"));
                    await this.actor.updateEmbeddedDocuments("Item", [this._toggleEquipped(t.data("item-id"), item)]);
                }
            },
            ...menu_items
        ]);



        // Drag events for macros.
        /*if (this.actor.isOwner) {
            let handler = (ev) => this._onDragItemStart(ev);
            html.find("li.box-item").each((i, li) => {
                if (li.classList.contains("header")) return;
                li.setAttribute("draggable", true);
                li.addEventListener("dragstart", handler, false);
            });
        }*/
    }

    async _updateNPCCreatureType(event) {
        let _creatureType = $(event.currentTarget).data("creature");
        await this.actor.update({ "system.creatureType": _creatureType });
        this.actor.sheet.render();
    }

    _editOwnedItemById(_itemId) {
        const item = this.actor.items.get(_itemId);
        item.sheet.render(true);
    }

    async _deleteOwnedItemById(_itemId) {
        await this.actor.deleteEmbeddedDocuments("Item", [_itemId]);
    }

    async _onChangeSkillValue(event) {
        event.preventDefault();
        const itemId = $(event.currentTarget).data("item-id");
        let _item = this.actor.items.find((element) => element.id == itemId);
        if (_item) {
            // let update = {
            //     _id: _item.id,
            //     data: { value: $(event.currentTarget).val() },
            // };
            let update = {
                _id: _item.id,
                system: { value: $(event.currentTarget).val() },
            };

            await this.actor.updateEmbeddedDocuments("Item", [update]);
        }
    }

    async _onChangeOwnedItemValue(event) {
        event.preventDefault();
        const itemId = $(event.currentTarget).data("item-id");
        let _item = this.actor.items.find((element) => element.id == itemId);
        let valueToChange = $(event.currentTarget).data("linked-value").toString();
        let newValue = $(event.currentTarget).val();
        if (_item) {
            await _item.update({ [valueToChange]: newValue });
        }
    }

    /**
     * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
     * @param {Event} event   The originating click event
     * @private
     */
    async _onItemCreate(event) {
        event.preventDefault();
        const header = event.currentTarget;
        const type = header.dataset.type;
        const data = duplicate(header.dataset);
        const name = `New ${type.capitalize()}`;
        const itemData = {
            name: name,
            type: type,
            data: data,
        };
        delete itemData.data["type"];
        return this.actor.createEmbeddedDocuments("Item", [itemData]);
    }

    _onItemView(event) {
        event.preventDefault();
        const item = this.actor.items.get($(event.currentTarget).data("item-id"));
        item.sheet.render(true);
    }

    _onItemSendToChat(event) {
        event.preventDefault();
        const itemId = $(event.currentTarget).data("item-id");
        this._onPostItem(itemId);
    }

    _onPostItem(_itemId) {
        const item = this.actor.items.get(_itemId);
        item.sendToChat();
    }

    _onRollAttribute(event) {
        event.preventDefault();
        const attName = $(event.currentTarget).data("attribute");
        const attVal = this.actor.system.attributes[attName].value;
        let rollName = `MYZ.ATTRIBUTE_${attName.toUpperCase()}_${this.actor.system.creatureType.toUpperCase()}`;

        const itmMap = this.actor.items.filter(itm => itm.system.modifiers != undefined)
        const itemsThatModifyAttribute = itmMap.filter(i => i.system.modifiers[attName] != 0)
        let modifiersToAttributes = []
        const baseDiceModifier = itemsThatModifyAttribute.reduce(function (acc, obj) {
            modifiersToAttributes.push({ 'type': obj.type, 'name': obj.name, 'value': obj.system.modifiers[attName] })
            return acc + obj.system.modifiers[attName];
        }, 0);
        let baseDiceTotal = parseInt(attVal) + parseInt(baseDiceModifier)
        if(baseDiceTotal<0) baseDiceTotal = 0;

        const applyedModifiersInfo = this._getModifiersInfo({
            skillDiceTotal: 0,
            baseDiceTotal: baseDiceTotal,
            gearDiceTotal: 0,
            modifiersToSkill: [],
            modifiersToAttributes: modifiersToAttributes,
            modifiersToGear: []
        })

        RollDialog.prepareRollDialog({
            rollName: rollName,
            attributeName: attName,
            diceRoller: this.diceRoller,
            baseDefault: baseDiceTotal,
            skillDefault: 0,
            gearDefault: 0,
            modifierDefault: 0,
            applyedModifiers: applyedModifiersInfo
        });
    }

    /**
     * Handle clickable rolls.
     * @param {Event} event   The originating click event
     * @private
     */
    _onRollSkill(event) {
        event.preventDefault();
        const element = event.currentTarget;
        const itemId = $(element).data("item-id");
        if (itemId) {
            //FIND OWNED SKILL ITEM AND CREARE ROLL DIALOG
            const skill = this.actor.items.find((element) => element.id == itemId);
            const attName = skill.system.attribute;
            // Apply any modifiers from items or crits
            const diceTotals = this._getRollModifiers(skill);
            diceTotals.gearDiceTotal = Math.max(0, diceTotals.gearDiceTotal)

            // SEE IF WE CAN USE SKILL KEY TO TRANSLATE THE NAME
            let skillName = "";
            if (skill.system.skillKey == "") {
                skillName = skill.name;
            } else {
                skillName = game.i18n.localize(`MYZ.SKILL_${skill.system.skillKey}`);
            }

            const applyedModifiersInfo = this._getModifiersInfo(diceTotals);
            //console.warn(applyedModifiersInfo)

            RollDialog.prepareRollDialog({
                rollName: skillName,
                attributeName: attName,
                diceRoller: this.diceRoller,
                baseDefault: diceTotals.baseDiceTotal,
                skillDefault: diceTotals.skillDiceTotal,
                gearDefault: diceTotals.gearDiceTotal,
                modifierDefault: 0,
                applyedModifiers: applyedModifiersInfo,
                actor: this.actor,
                skillItem: skill
            });
        }
    }

    //Toggle Equiping Armor
    _toggleEquipped(id, item) {
        return {
            _id: id,
            system: {
                equipped: !item.system.equipped,
            },
        };
    }


    //Toggle Stahsing
    _toggleStashed(id, item) {
        return {
            _id: id,
            system: {
                stashed: !item.system.stashed,
            },
        };
    }

    //Toggle Broken
    _toggleBroken(id, item) {
        return {
            _id: id,
            system: {
                broken: !item.system.broken,
            },
        };
    }

    _getRollModifiers(skill) {
        // SKILL MODIFIERS
        let skillDiceTotal = parseInt(skill.system.value);     
        const itmMap = this.actor.items.filter(itm => itm.system.modifiers != undefined)
        const itemsThatModifySkill = itmMap.filter(i => i.system.modifiers[skill.system.skillKey] != 0)
        let modifiersToSkill = []
        if(skill.system.skillKey!=""){ 
            const skillDiceModifier = itemsThatModifySkill.reduce(function (acc, obj) {
                modifiersToSkill.push({ 'type': obj.type, 'name': obj.name, 'value': obj.system.modifiers[skill.system.skillKey] })
                return acc + obj.system.modifiers[skill.system.skillKey];
            }, 0);        
            skillDiceTotal += parseInt(skillDiceModifier)
        }
        // ATTRIBUTE MODIFIERS  
        const itemsThatModifyAttribute = itmMap.filter(i => i.system.modifiers[skill.system.attribute] != 0)
        let modifiersToAttributes = []
        const baseDiceModifier = itemsThatModifyAttribute.reduce(function (acc, obj) {
            modifiersToAttributes.push({ 'type': obj.type, 'name': obj.name, 'value': obj.system.modifiers[skill.system.attribute] })
            return acc + obj.system.modifiers[skill.system.attribute];
        }, 0);
        const baseDice = this.actor.system.attributes[skill.system.attribute].value;
        let baseDiceTotal = parseInt(baseDice) + parseInt(baseDiceModifier);
        if(baseDiceTotal<0) baseDiceTotal = 0;
        // GEAR MODIFIERS  
        const itmGMap = this.actor.items.filter(itm => itm.system.gearModifiers != undefined)
        const itemsThatModifyGear = itmGMap.filter(i => i.system.gearModifiers[skill.system.skillKey] != 0)
        let modifiersToGear = []
        let gearDiceTotal = 0
        if(skill.system.skillKey!=""){
            const gearDiceModifier = itemsThatModifyGear.reduce(function (acc, obj) {
                modifiersToGear.push({ 'type': obj.type, 'name': obj.name, 'value': obj.system.gearModifiers[skill.system.skillKey] })
                return acc + obj.system.gearModifiers[skill.system.skillKey];
            }, 0);
            gearDiceTotal = parseInt(gearDiceModifier)
        }

        return {
            skillDiceTotal: skillDiceTotal,
            baseDiceTotal: baseDiceTotal,
            gearDiceTotal: gearDiceTotal,
            modifiersToSkill: modifiersToSkill,
            modifiersToAttributes: modifiersToAttributes,
            modifiersToGear: modifiersToGear
        }
    }

    // Return a string describing applyed modifiers
    _getModifiersInfo(diceTotals) {
        let modifiersToSkillInfo = ""
        const modifiersToSkillTotal = diceTotals.modifiersToSkill.reduce(function (acc, obj) {
            modifiersToSkillInfo += `<p style='font-size:0.75rem'>${obj.name}: ${obj.value}</p>`
            return acc + obj.value
        }, 0)

        let modifiersToAttributesInfo = ""
        const modifiersToAttributesTotal = diceTotals.modifiersToAttributes.reduce(function (acc, obj) {
            modifiersToAttributesInfo += `<p style='font-size:0.75rem'>${obj.name}: ${obj.value}</p>`
            return acc + obj.value
        }, 0)

        let modifiersToGearInfo = ""
        const modifiersToGearTotal = diceTotals.modifiersToGear.reduce(function (acc, obj) {
            modifiersToGearInfo += `<p style='font-size:0.75rem'>${obj.name}: ${obj.value}</p>`
            return acc + obj.value
        }, 0)

        let applyedModifiers = {
            info: `<p>Applyed Modifiers</p><p>Attribute: ${modifiersToAttributesTotal}</p><p>Skill: ${modifiersToSkillTotal}</p><p>Gear: ${modifiersToGearTotal}</p>`,
            modifiersToSkillInfo: modifiersToSkillInfo,
            modifiersToAttributesInfo: modifiersToAttributesInfo,
            modifiersToGearInfo: modifiersToGearInfo
        }

        return applyedModifiers;
    }
}
