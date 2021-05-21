/**
 * Extend the basic Item with some very simple modifications.
 * @extends {Item}
 */
export class MYZItem extends Item {
    /**
     * Augment the basic Item data model with additional dynamic data.
     */
    prepareData() {
        super.prepareData();
        // Get the Item's data
        const itemData = this.data;
        //const actorData = this.actor ? this.actor.data : {};
        const data = itemData.data;
        data.itemType = itemData.type;
        data.default_attributes = CONFIG.MYZ.attributes;
    }


    async sendToChat() {
        const itemData = duplicate(this.data);
        if (itemData.img.includes("/mystery-man")) {
            itemData.img = null;
        }
        itemData.isWeapon = itemData.type === "weapon";
        itemData.isArmor = itemData.type === "armor";
        itemData.isChassis = itemData.type === "chassis";
        itemData.isCritical = itemData.type === "critical";
        itemData.isGear = itemData.type === "gear";
        itemData.isArtifact = itemData.type === "artifact";
        itemData.isTalent = itemData.type === "talent";
        itemData.isAbility = itemData.type === "ability";
        itemData.isProject = itemData.type === "project";
        itemData.isSkill = itemData.type === "skill";
        if (this.parent)
            itemData.creatureType = this.actor.data.data.creatureType;
        const html = await renderTemplate("systems/mutant-year-zero/templates/chat/item.html", itemData);
        const chatData = {
            user: game.user.id,
            rollMode: game.settings.get("core", "rollMode"),
            content: html,
        };
        if (["gmroll", "blindroll"].includes(chatData.rollMode)) {
            chatData.whisper = ChatMessage.getWhisperRecipients("GM");
        } else if (chatData.rollMode === "selfroll") {
            chatData.whisper = [game.user];
        }
        ChatMessage.create(chatData);
    }
}
